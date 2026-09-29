export type TurnstileWidget = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact' | 'flexible';
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
  }) => string | number;
  reset: (widgetId?: string | number) => void;
  remove?: (widgetId?: string | number) => void;
};

declare global {
  interface Window { turnstile?: TurnstileWidget; __studentHubTurnstilePromise?: Promise<void>; }
}

export const CAPTCHA_REQUIRED = String(import.meta.env.VITE_CAPTCHA_REQUIRED ?? 'true').toLowerCase() === 'true';
export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();
export const CAPTCHA_CONFIGURED = Boolean(TURNSTILE_SITE_KEY);

export function captchaConfiguredForProduction(): boolean {
  return !CAPTCHA_REQUIRED || CAPTCHA_CONFIGURED;
}

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__studentHubTurnstilePromise) return window.__studentHubTurnstilePromise;
  window.__studentHubTurnstilePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-student-hub-turnstile]');
    if (existing) {
      const timeout = window.setTimeout(() => reject(new Error('TURNSTILE_SCRIPT_TIMEOUT')), 12000);
      const poll = () => {
        if (window.turnstile) { window.clearTimeout(timeout); resolve(); return; }
        window.setTimeout(poll, 50);
      };
      poll();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.studentHubTurnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('TURNSTILE_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  });
  return window.__studentHubTurnstilePromise;
}

export function resetTurnstile(widgetId: string | number | null | undefined): void {
  try { if (widgetId !== null && widgetId !== undefined) window.turnstile?.reset(widgetId); } catch { /* ignore widget reset errors */ }
}
