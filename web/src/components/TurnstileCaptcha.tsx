import { useEffect, useRef, useState } from 'react';
import { CAPTCHA_CONFIGURED, loadTurnstileScript, resetTurnstile, TURNSTILE_SITE_KEY } from '../lib/captcha';

type Props = {
  onToken: (token: string) => void;
  resetKey?: number;
  action?: 'login' | 'signup' | 'recovery';
};

type Status = 'loading' | 'ready' | 'expired' | 'error' | 'missing';

function humanizeTurnstileError(code?: string): string {
  if (code === '400100') return 'Site key atau konfigurasi widget tidak valid.';
  if (code === '400200') return 'Hostname halaman ini belum diizinkan oleh widget Turnstile.';
  if (code === '400030') return 'Widget Turnstile belum dapat digunakan di halaman ini.';
  return code ? `Cloudflare Turnstile mengembalikan kode ${code}.` : 'Periksa hostname widget dan koneksi ke challenges.cloudflare.com.';
}

export function TurnstileCaptcha({ onToken, resetKey = 0, action = 'login' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorDetail, setErrorDetail] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!CAPTCHA_CONFIGURED) {
      setStatus('missing');
      setErrorDetail('Site key Turnstile belum masuk ke production build.');
      onToken('');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorDetail('');
    onToken('');

    const mount = async () => {
      try {
        await loadTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;
        const existingWidgetId = widgetIdRef.current;
        widgetIdRef.current = null;
        if (existingWidgetId !== null && existingWidgetId !== undefined) {
          try {
            window.turnstile.remove?.(existingWidgetId);
          } catch {
            /* Ignore cleanup failures from a widget that is already gone. */
          }
        }
        containerRef.current.innerHTML = '';

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          size: 'normal',
          action,
          'refresh-expired': 'auto',
          callback: (token) => {
            if (cancelled) return;
            setStatus('ready');
            setErrorDetail('');
            onToken(token);
          },
          'expired-callback': () => {
            if (cancelled) return;
            setStatus('expired');
            onToken('');
          },
          'timeout-callback': () => {
            if (cancelled) return;
            setStatus('error');
            onToken('');
            setErrorDetail('Verifikasi Turnstile terlalu lama. Coba muat ulang.');
          },
          'unsupported-callback': () => {
            if (cancelled) return;
            setStatus('error');
            onToken('');
            setErrorDetail('Browser ini tidak mendukung Turnstile. Gunakan browser modern dan aktifkan JavaScript.');
          },
          'error-callback': (code) => {
            if (cancelled) return;
            setStatus('error');
            onToken('');
            setErrorDetail(humanizeTurnstileError(code));
          },
        });
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        onToken('');
        setErrorDetail(error instanceof Error ? error.message : 'Script Turnstile gagal dimuat.');
      }
    };

    void mount();

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null) {
        try { window.turnstile?.remove?.(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
    };
  }, [action, onToken, retryNonce]);

  useEffect(() => {
    if (!resetKey || !CAPTCHA_CONFIGURED) return;
    resetTurnstile(widgetIdRef.current);
    onToken('');
  }, [resetKey, onToken]);

  if (status === 'missing') {
    return <div className="captcha-status captcha-error" role="alert"><strong>CAPTCHA belum tersedia</strong><small>Build production belum membawa VITE_TURNSTILE_SITE_KEY.</small></div>;
  }

  return <div className="captcha-panel" aria-label="Verifikasi keamanan CAPTCHA">
    <div className="captcha-panel-head"><span>Verifikasi keamanan</span><small>{status === 'loading' ? 'Memuat…' : status === 'error' ? 'Gagal' : status === 'expired' ? 'Kedaluwarsa' : 'Cloudflare Turnstile'}</small></div>
    <div className="captcha-wrap"><div ref={containerRef} className="turnstile-box" /></div>
    {status === 'loading' && <div className="captcha-status"><small>Menyiapkan verifikasi Cloudflare…</small></div>}
    {status === 'expired' && <div className="captcha-status captcha-warning"><small>Verifikasi kedaluwarsa. Selesaikan CAPTCHA lagi sebelum masuk.</small></div>}
    {status === 'error' && <div className="captcha-status captcha-error" role="alert"><strong>CAPTCHA gagal dimuat.</strong><small>{errorDetail}</small><button type="button" className="captcha-retry" onClick={() => setRetryNonce(v => v + 1)}>Coba muat ulang CAPTCHA</button></div>}
  </div>;
}
