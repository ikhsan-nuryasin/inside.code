import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Field } from '../components/ui';
import { DEMO_MODE, supabase } from '../lib/supabase';
import { CAPTCHA_CONFIGURED, CAPTCHA_REQUIRED, TURNSTILE_SITE_KEY } from '../lib/captcha';
import { AUTH_RATE_RULES } from '../lib/auth-guard';
import { nav } from '../lib/router';
import { requestConfirm } from '../components/DialogHost';

type Factor = { id: string; friendly_name?: string; factor_type: string; status: string };

export function SecurityPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [aal, setAal] = useState('aal1');
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (DEMO_MODE || !supabase) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [factorResult, aalResult, userResult] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.getUser()]);
      if (userResult.error) throw userResult.error;
      if (factorResult.error) throw factorResult.error;
      setFactors([...factorResult.data.totp, ...factorResult.data.phone] as Factor[]);
      setAal(aalResult.data.currentLevel || 'aal1');
      setEmailVerified(Boolean(userResult.data.user?.email_confirmed_at));
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat keamanan akun.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const beginEnroll = async () => {
    if (!supabase) return;
    setBusy(true); setError('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Student Hub ${new Date().toLocaleDateString('id-ID')}` });
      if (enrollError) throw enrollError;
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
      setCode('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal membuat MFA.'); }
    finally { setBusy(false); }
  };
  const verifyEnroll = async () => {
    if (!supabase || !enroll) return;
    const otp = code.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(otp)) { setError('Masukkan kode 6 digit.'); return; }
    setBusy(true); setError('');
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.id });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: challenge.data.id, code: otp });
      if (verified.error) throw verified.error;
      setEnroll(null); setCode(''); await supabase.auth.refreshSession(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kode MFA tidak valid.'); }
    finally { setBusy(false); }
  };
  const removeFactor = async (factorId: string) => {
    if (!supabase) return;
    const ok = await requestConfirm('MFA akan dimatikan pada akun ini. Pastikan kamu masih memiliki akses ke email dan password.', { title:'Nonaktifkan verifikasi dua langkah?', confirmLabel:'Nonaktifkan', cancelLabel:'Batal' });
    if (!ok) return;
    setBusy(true); setError('');
    try { const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId }); if (unenrollError) throw unenrollError; await supabase.auth.refreshSession(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal menonaktifkan MFA.'); }
    finally { setBusy(false); }
  };
  const globalLogout = async () => { if (!supabase || DEMO_MODE) return; setBusy(true); try { const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' }); if (signOutError) throw signOutError; nav('/dashboard'); location.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengakhiri semua sesi.'); } finally { setBusy(false); } };

  const verified = factors.filter(f => f.status === 'verified');
  return <div className="stack-page security-page">
    <div className="mobile-page-head"><button className="mobile-back" onClick={()=>nav('/settings')} aria-label="Kembali">‹</button><div><h2>Keamanan Akun</h2><small>Lapisan perlindungan Student Hub</small></div></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <Card className="security-hero"><div><span className="eyebrow">Security center</span><h3>Kelola keamanan akun</h3><p>CAPTCHA melindungi endpoint autentikasi dari bot, sedangkan MFA menambah verifikasi kedua saat login.</p></div><Badge tone={verified.length ? 'good' : 'warn'}>{verified.length ? 'MFA aktif' : 'MFA belum aktif'}</Badge></Card>

    <div className="grid-2">
      <Card className="security-card"><div className="section-head"><div><span className="eyebrow">Bot protection</span><h3>Cloudflare Turnstile</h3></div><Badge tone={CAPTCHA_REQUIRED && CAPTCHA_CONFIGURED ? 'good' : 'warn'}>{CAPTCHA_REQUIRED && CAPTCHA_CONFIGURED ? 'Siap' : 'Konfigurasi'}</Badge></div><p className="muted">CAPTCHA digunakan pada login, daftar akun, dan reset password. Supabase Auth menerima token CAPTCHA dan melakukan validasi pada alur autentikasi.</p><div className="security-facts"><div><small>Mode</small><strong>{CAPTCHA_REQUIRED ? 'Wajib' : 'Opsional'}</strong></div><div><small>Site key</small><strong>{CAPTCHA_CONFIGURED ? `${TURNSTILE_SITE_KEY.slice(0, 8)}…` : 'Belum ada'}</strong></div><div><small>Rate limit client</small><strong>{AUTH_RATE_RULES.maxFailures} gagal / {AUTH_RATE_RULES.windowMinutes} menit</strong></div></div>{DEMO_MODE&&<div className="alert alert-info">Demo mode tidak mengaktifkan CAPTCHA production.</div>}</Card>
      <Card className="security-card"><div className="section-head"><div><span className="eyebrow">Account</span><h3>Status akun</h3></div><Badge tone={emailVerified?'good':'warn'}>{emailVerified?'Terverifikasi':'Perlu verifikasi'}</Badge></div><div className="security-facts"><div><small>Email</small><strong>{emailVerified===null?'Memeriksa…':emailVerified?'Terverifikasi':'Belum diverifikasi'}</strong></div><div><small>Session</small><strong>{aal.toUpperCase()}</strong></div><div><small>MFA</small><strong>{verified.length ? 'Aktif' : 'Opsional'}</strong></div></div><p className="muted">Untuk production, aktifkan Confirm Email di Supabase Auth agar akun harus memverifikasi alamat email sebelum akses penuh.</p><div className="button-row"><Button variant="danger" disabled={busy || DEMO_MODE} onClick={()=>void globalLogout()}>Keluar dari semua perangkat</Button></div></Card>
    </div>

    <Card className="security-mfa-card"><div className="section-head"><div><span className="eyebrow">MFA / 2FA</span><h3>Authenticator App</h3></div>{verified.length?<Badge tone="good">{verified.length} faktor aktif</Badge>:<Badge tone="neutral">Opsional</Badge>}</div><p className="muted">Tambahkan TOTP menggunakan aplikasi authenticator. Setelah aktif, login Student Hub akan meminta kode 6 digit.</p>
      {!verified.length && !enroll && !DEMO_MODE && <Button disabled={busy} onClick={()=>void beginEnroll()}>{busy?'Menyiapkan…':'Aktifkan MFA'}</Button>}
      {DEMO_MODE && <div className="alert alert-info">MFA production tersedia saat Student Hub terhubung ke Supabase.</div>}
      {enroll && <div className="mfa-enroll-box"><div><img className="mfa-qr" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enroll.qr)}`} alt="QR code MFA" /><small className="muted">Scan QR dengan aplikasi authenticator.</small></div><div className="stack-form"><Field label="Kode 6 digit"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" /></Field><div className="security-secret"><small>Secret manual</small><code>{enroll.secret}</code></div><Button disabled={busy || code.length !== 6} onClick={()=>void verifyEnroll()}>{busy?'Memverifikasi…':'Verifikasi & aktifkan'}</Button><Button variant="ghost" disabled={busy} onClick={()=>setEnroll(null)}>Batal</Button></div></div>}
      {verified.map(f=><div className="mfa-factor-row" key={f.id}><div><strong>{f.friendly_name || 'Authenticator'}</strong><small>{f.factor_type.toUpperCase()} · {f.status}</small></div><Button variant="danger" disabled={busy || aal!=='aal2'} onClick={()=>void removeFactor(f.id)}>Nonaktifkan</Button></div>)}
      {loading && <small className="muted">Memuat status MFA…</small>}
    </Card>

    <Card className="security-checklist"><div className="section-head"><div><span className="eyebrow">Checklist production</span><h3>Keamanan yang harus diaktifkan</h3></div></div><div className="security-list"><div>✓ Supabase CAPTCHA untuk sign-in/sign-up/recovery</div><div>✓ Rate limit Auth Supabase</div><div>✓ RLS di semua tabel exposed</div><div>✓ Publishable key saja di browser</div><div>✓ HTTPS + security headers</div><div>✓ MFA TOTP untuk akun yang membutuhkan keamanan ekstra</div><div>✓ Password policy + leaked-password protection di Supabase</div><div>✓ Monitoring + audit log untuk aktivitas sensitif</div></div></Card>
  </div>;
}
