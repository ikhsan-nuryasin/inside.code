import { supabase } from './supabase';

export const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
export const PUSH_CONFIGURED = Boolean(VAPID_PUBLIC_KEY);

export type PushState = {
  supported: boolean;
  secureContext: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  vapidConfigured: boolean;
  iosHomeScreenRequired: boolean;
};

function isIos(): boolean {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(input: string) {
  const padding = '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export async function getPushState(): Promise<PushState> {
  const supported = pushSupported();
  const permission = supported ? Notification.permission : 'unsupported';
  let subscribed = false;
  if (supported && !import.meta.env.DEV) {
    try {
      const registration = await navigator.serviceWorker.ready;
      subscribed = Boolean(await registration.pushManager.getSubscription());
    } catch { /* browser may deny access */ }
  }
  return {
    supported,
    secureContext: window.isSecureContext,
    permission,
    subscribed,
    vapidConfigured: PUSH_CONFIGURED,
    iosHomeScreenRequired: isIos() && !isStandalone(),
  };
}

export async function enablePushNotifications(preferences: Record<string, boolean>) {
  if (!pushSupported()) throw new Error('BROWSER_PUSH_NOT_SUPPORTED');
  if (import.meta.env.DEV) throw new Error('PUSH_USE_PREVIEW_BUILD');
  if (!window.isSecureContext) throw new Error('PUSH_REQUIRES_HTTPS');
  if (!PUSH_CONFIGURED) throw new Error('VAPID_PUBLIC_KEY_NOT_CONFIGURED');
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'PUSH_PERMISSION_DENIED' : 'PUSH_PERMISSION_NOT_GRANTED');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('UNAUTHENTICATED');

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('PUSH_SUBSCRIPTION_INVALID');

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userData.user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 500),
    device_label: getDeviceLabel(),
    enabled: true,
    preferences,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' });
  if (error) throw error;
  return subscription;
}

export async function disablePushNotifications() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try { await subscription.unsubscribe(); } finally {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userData.user.id).eq('endpoint', endpoint);
      if (error) throw error;
    }
  }
}

export async function updatePushPreferences(preferences: Record<string, boolean>) {
  if (!supabase || !pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from('push_subscriptions').update({ preferences, enabled: true, last_seen_at: new Date().toISOString() }).eq('user_id', userData.user.id).eq('endpoint', subscription.endpoint);
  if (error) throw error;
}

export async function sendPushTest() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  const { data, error } = await supabase.functions.invoke('send-notification-push', { body: { action: 'test' } });
  if (error) throw error;
  return data as { ok: boolean; attempted: number; sent: number; failed: number };
}

function getDeviceLabel() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'Browser';
}
