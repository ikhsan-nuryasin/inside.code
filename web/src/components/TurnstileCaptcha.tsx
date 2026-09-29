import { useEffect, useRef } from 'react';
import { CAPTCHA_CONFIGURED, loadTurnstileScript, resetTurnstile, TURNSTILE_SITE_KEY } from '../lib/captcha';

export function TurnstileCaptcha({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!CAPTCHA_CONFIGURED || !containerRef.current) return;
    let cancelled = false;
    void loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      containerRef.current.innerHTML = '';
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        size: 'flexible',
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    }).catch(() => onToken(''));
    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null) {
        try { window.turnstile?.remove?.(widgetIdRef.current); } catch { /* noop */ }
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  useEffect(() => {
    if (!resetKey) return;
    resetTurnstile(widgetIdRef.current);
    onToken('');
  }, [resetKey, onToken]);

  if (!CAPTCHA_CONFIGURED) {
    return <div className="captcha-missing" role="alert">CAPTCHA belum dikonfigurasi. Untuk production, isi <code>VITE_TURNSTILE_SITE_KEY</code>.</div>;
  }
  return <div className="captcha-wrap"><div ref={containerRef} className="turnstile-box" aria-label="Verifikasi keamanan CAPTCHA" /></div>;
}
