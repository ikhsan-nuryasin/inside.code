export type TurnstileWidget = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact' | 'flexible';
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: (errorCode?: string) => void;
    'timeout-callback'?: () => void;
    'unsupported-callback'?: () => void;
    action?: string;
    'refresh-expired'?: 'auto' | 'manual';
  }) => string | number;
  reset: (widgetId?: string | number) => void;
  remove?: (widgetId?: string | number) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
    __insideCodeTurnstilePromise?: Promise<void>;
  }
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
  if (window.__insideCodeTurnstilePromise) return window.__insideCodeTurnstilePromise;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-inside-code-turnstile], script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
    const startedAt = Date.now();

    const finish = () => {
      if (window.turnstile) {
        resolve();
        return true;
      }
      return false;
    };

    if (existing) {
      const timeout = window.setTimeout(() => reject(new Error('TURNSTILE_SCRIPT_TIMEOUT')), 15000);
      const poll = () => {
        if (finish()) { window.clearTimeout(timeout); return; }
        if (Date.now() - startedAt > 15000) { window.clearTimeout(timeout); reject(new Error('TURNSTILE_SCRIPT_TIMEOUT')); return; }
        window.setTimeout(poll, 50);
      };
      poll();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.insideCodeTurnstile = 'true';
    script.onload = () => {
      if (!finish()) reject(new Error('TURNSTILE_API_NOT_AVAILABLE'));
    };
    script.onerror = () => reject(new Error('TURNSTILE_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__insideCodeTurnstilePromise = undefined;
    throw error;
  });

  window.__insideCodeTurnstilePromise = promise;
  return promise;
}

export function resetTurnstile(widgetId: string | number | null | undefined): void {
  try { if (widgetId !== null && widgetId !== undefined) window.turnstile?.reset(widgetId); } catch { /* ignore widget reset errors */ }
}
