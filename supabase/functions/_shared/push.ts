import * as webpush from 'jsr:@negrel/webpush@^0.5.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
  fail_count: number;
  preferences: Record<string, boolean> | null;
};

type NotificationRecord = {
  id?: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
};

function getSecretKey(): string {
  const json = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (json) {
    try {
      const keys = JSON.parse(json) as Record<string, string>;
      const first = keys.default ?? Object.values(keys)[0];
      if (first) return first;
    } catch { /* legacy fallback below */ }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('SUPABASE secret key not configured for Edge Function');
}

export function createAdminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey());
}

let applicationServerPromise: Promise<webpush.ApplicationServer> | null = null;

async function getApplicationServer() {
  if (applicationServerPromise) return applicationServerPromise;
  applicationServerPromise = (async () => {
    const publicJwk = Deno.env.get('VAPID_PUBLIC_JWK');
    const privateJwk = Deno.env.get('VAPID_PRIVATE_JWK');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicJwk || !privateJwk || !subject) throw new Error('VAPID secrets are not configured');
    const vapidKeys = await webpush.importVapidKeys({
      publicKey: JSON.parse(publicJwk),
      privateKey: JSON.parse(privateJwk),
    });
    return webpush.ApplicationServer.new({
      contactInformation: subject,
      vapidKeys,
    });
  })();
  return applicationServerPromise;
}

function appUrl(): string {
  return String(Deno.env.get('PUSH_APP_URL') || '').replace(/\/$/, '');
}

function routeForNotification(n: NotificationRecord): string {
  const data = n.data ?? {};
  const explicitUrl = typeof data.url === 'string' ? data.url.trim() : '';
  if (explicitUrl) return explicitUrl.startsWith('#') ? explicitUrl : `#${explicitUrl.replace(/^\//, '')}`;
  const classId = typeof data.class_id === 'string' ? data.class_id : typeof data.classId === 'string' ? data.classId : '';
  const assignmentId = typeof data.assignment_id === 'string' ? data.assignment_id : typeof data.taskId === 'string' ? data.taskId : '';
  const materialId = typeof data.material_id === 'string' ? data.material_id : typeof data.materialId === 'string' ? data.materialId : '';
  const announcementId = typeof data.announcement_id === 'string' ? data.announcement_id : typeof data.announcementId === 'string' ? data.announcementId : '';
  const topicId = typeof data.topic_id === 'string' ? data.topic_id : typeof data.topicId === 'string' ? data.topicId : '';
  const pollId = typeof data.poll_id === 'string' ? data.poll_id : typeof data.pollId === 'string' ? data.pollId : '';
  const eventId = typeof data.event_id === 'string' ? data.event_id : typeof data.eventId === 'string' ? data.eventId : '';

  if (classId && assignmentId && n.notification_type === 'assignment') return `#/classes/${classId}?tab=tasks&item=${encodeURIComponent(assignmentId)}`;
  if (classId && materialId && n.notification_type === 'material') return `#/classes/${classId}?tab=materials&item=${encodeURIComponent(materialId)}`;
  if (classId && announcementId && n.notification_type === 'announcement') return `#/classes/${classId}?tab=announcements&item=${encodeURIComponent(announcementId)}`;
  if (classId && topicId && n.notification_type === 'forum') return `#/classes/${classId}?tab=forum&item=${encodeURIComponent(topicId)}`;
  if (classId && pollId && n.notification_type === 'poll') return `#/classes/${classId}?tab=polling&item=${encodeURIComponent(pollId)}`;
  if (classId && eventId && (n.notification_type === 'schedule' || n.notification_type === 'group')) return `#/classes/${classId}?tab=calendar&item=${encodeURIComponent(eventId)}`;
  if (n.notification_type === 'cash') return '#/cash';
  if (n.notification_type === 'schedule') return '#/calendar';
  return '#/notifications';
}

function normalizeUrl(route: string): string {
  const origin = appUrl();
  if (!origin) return route;
  if (/^https?:\/\//i.test(route)) return route;
  return `${origin}/${route.startsWith('#') ? route : `#${route}`}`;
}

function preferenceEnabled(sub: PushSubscriptionRow, type: string): boolean {
  return sub.enabled && (sub.preferences?.[type] ?? true) !== false;
}

export async function sendNotificationToUser(client: SupabaseClient, notification: NotificationRecord, userIdOverride?: string) {
  const userId = userIdOverride ?? notification.user_id;
  const { data: subscriptions, error } = await client
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth,enabled,preferences,fail_count')
    .eq('user_id', userId)
    .eq('enabled', true);
  if (error) throw error;

  const appServer = await getApplicationServer();
  const url = normalizeUrl(routeForNotification(notification));
  const title = String(notification.title || 'Inside Code').slice(0, 160);
  const body = String(notification.body || '').slice(0, 280);
  const payload = JSON.stringify({
    id: notification.id,
    title,
    body,
    icon: `${appUrl()}/icons/icon-192.png`,
    badge: `${appUrl()}/icons/icon-192.png`,
    tag: `inside-code-${notification.id ?? crypto.randomUUID()}`,
    payload: { url },
  });

  const results = await Promise.allSettled(
    ((subscriptions ?? []) as PushSubscriptionRow[])
      .filter((sub) => preferenceEnabled(sub, notification.notification_type))
      .map(async (sub) => {
        const subscriber = appServer.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
        try {
          await subscriber.pushTextMessage(payload, { ttl: 24 * 60 * 60 });
          await client.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), last_error: null, fail_count: 0, last_seen_at: new Date().toISOString() }).eq('id', sub.id);
          return { id: sub.id, sent: true };
        } catch (error) {
          const gone = error instanceof webpush.PushMessageError && error.isGone();
          if (gone) {
            await client.from('push_subscriptions').delete().eq('id', sub.id);
          } else {
            await client.from('push_subscriptions').update({ last_error: error instanceof Error ? error.message : String(error), fail_count: Math.min(Number(sub.fail_count || 0) + 1, 20) }).eq('id', sub.id);
          }
          throw error;
        }
      }),
  );

  return {
    attempted: results.length,
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}

export function isWebhookSecret(req: Request): boolean {
  const expected = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!expected) return false;
  return req.headers.get('x-inside-code-webhook-secret') === expected || req.headers.get('x-student-hub-webhook-secret') === expected;
}

export async function getAuthenticatedUserId(client: SupabaseClient, req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
