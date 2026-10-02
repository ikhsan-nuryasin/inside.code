import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Field } from '../components/ui';
import { supabase } from '../lib/supabase';

export function MfaChallengePage({ onVerified, onLogout }: { onVerified: () => void; onLogout: () => Promise<void> }) {
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const factor = [...factors.data.totp, ...factors.data.phone].find(f => f.status === 'verified');
        if (!factor) throw new Error('MFA_REQUIRED_BUT_NO_VERIFIED_FACTOR');
        const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (challenge.error) throw challenge.error;
        if (!cancelled) { setFactorId(factor.id); setChallengeId(challenge.data.id); setBusy(false); }
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Gagal menyiapkan verifikasi dua langkah.'); setBusy(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const masked = useMemo(() => code.replace(/\D/g, '').slice(0, 6), [code]);
  const verify = async () => {
    if (!supabase || !factorId || !challengeId) return;
    if (!/^\d{6}$/.test(masked)) { setError('Masukkan 6 digit kode authenticator.'); return; }
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.mfa.verify({ factorId, challengeId, code: masked });
      if (result.error) throw result.error;
      await supabase.auth.refreshSession();
      onVerified();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kode MFA tidak valid.'); setBusy(false); }
  };

  return <div className="auth-layout security-auth-layout">
    <div className="auth-hero"><div className="hero-mark"><img src="/icon.svg" alt="Inside Code" /></div><span className="eyebrow">Verifikasi keamanan</span><h1>Konfirmasi login kamu.</h1><p>Akun ini memiliki verifikasi dua langkah. Masukkan kode 6 digit dari aplikasi authenticator untuk melanjutkan.</p></div>
    <Card className="auth-card mfa-challenge-card">
      <div className="auth-card-head"><h2>Verifikasi dua langkah</h2><p>Gunakan Google Authenticator, Microsoft Authenticator, 1Password, atau aplikasi TOTP lain.</p></div>
      <form className="stack-form" onSubmit={e => { e.preventDefault(); void verify(); }}>
        <Field label="Kode authenticator"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\\d{6}" value={masked} onChange={e=>setCode(e.target.value)} placeholder="000000" /></Field>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <Button type="submit" disabled={busy || masked.length !== 6}>{busy?'Memverifikasi…':'Verifikasi & lanjutkan'}</Button>
        <Button type="button" variant="ghost" onClick={()=>void onLogout()}>Keluar dari akun</Button>
        <p className="security-challenge-note">Setelah verifikasi selesai, kamu bisa mengelola MFA dari Pengaturan → Keamanan.</p>
      </form>
    </Card>
  </div>;
}
