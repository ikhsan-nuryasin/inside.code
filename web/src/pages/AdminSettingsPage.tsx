import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Badge, Button, Card, Field } from '../components/ui';
import { nav } from '../lib/router';
import { DEFAULT_APP_SETTINGS, getAppSettings, isSystemAdmin, type AppSettings, updateAppSettings, uploadAppLogo } from '../lib/app-settings';
import { showToast } from '../components/ToastHost';
import { CAPTCHA_CONFIGURED, CAPTCHA_REQUIRED, TURNSTILE_SITE_KEY } from '../lib/captcha';
import { VAPID_PUBLIC_KEY } from '../lib/push';
import { SUPABASE_CONFIGURED, supabase } from '../lib/supabase';

export function AdminSettingsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isSystemAdmin();
      setAllowed(ok);
      if (ok) setSettings(await getAppSettings());
    })().catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat panel admin.'));
  }, []);

  useEffect(() => () => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await updateAppSettings(settings);
      setSettings(next);
      setMessage('Pengaturan aplikasi berhasil disimpan.');
      showToast('Pengaturan Inside Code diperbarui.', 'good');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.');
    } finally { setBusy(false); }
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const url = await uploadAppLogo(file);
      setPreviewUrl((old) => { if (old?.startsWith('blob:')) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
      const next = await updateAppSettings({ ...settings, logo_url: url });
      setSettings(next);
      setMessage('Logo berhasil diunggah dan diterapkan.');
      showToast('Logo aplikasi diperbarui.', 'good');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah logo.');
    } finally { setBusy(false); e.target.value = ''; }
  };

  const resetBranding = async () => {
    setBusy(true); setError('');
    try {
      const next = await updateAppSettings(DEFAULT_APP_SETTINGS);
      setSettings(next); setPreviewUrl(null); setMessage('Branding dikembalikan ke default.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengembalikan branding.'); }
    finally { setBusy(false); }
  };

  if (allowed === null) return <div className="loading-screen"><div className="spinner" /><strong>Memeriksa akses administrator…</strong></div>;
  if (!allowed) return <div className="stack-page"><Card><span className="eyebrow">403</span><h2>Akses administrator diperlukan</h2><p className="muted">Akun ini belum mempunyai akses panel admin.</p><Button onClick={() => nav('/dashboard')}>Kembali ke dashboard</Button></Card></div>;

  const logo = previewUrl || settings.logo_url || '/icon.svg';
  return <div className="stack-page admin-settings-page">
    <div className="page-title"><div><span className="eyebrow">Administrator</span><h2>Inside Code — Pengaturan Aplikasi</h2><p>Kelola identitas aplikasi, logo, halaman login, dan konfigurasi tampilan dari satu tempat.</p></div><div className="page-title-actions"><Badge tone="good">Admin</Badge><Button variant="ghost" onClick={() => nav('/settings')}>Kembali</Button></div></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-info" role="status">{message}</div>}

    <div className="admin-settings-grid">
      <Card className="admin-brand-card">
        <div className="section-head"><div><span className="eyebrow">Branding</span><h3>Logo aplikasi</h3></div><Badge tone="info">Supabase Storage</Badge></div>
        <div className="admin-logo-preview"><img src={logo} alt="Preview logo" /></div>
        <Field label="Upload logo"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy}/><small>PNG, JPG, atau WEBP · maksimal 2 MB.</small></Field>
        <div className="button-row"><Button variant="ghost" disabled={busy} onClick={() => setPreviewUrl(null)}>Gunakan logo tersimpan</Button><Button variant="danger" disabled={busy} onClick={()=>void resetBranding()}>Reset branding</Button></div>
      </Card>

      <Card>
        <div className="section-head"><div><span className="eyebrow">Identity</span><h3>Nama & identitas</h3></div></div>
        <form onSubmit={save} className="stack-form">
          <Field label="Nama aplikasi"><input value={settings.app_name} onChange={e=>setSettings(s=>({...s,app_name:e.target.value}))} maxLength={80} required /></Field>
          <Field label="Nama singkat"><input value={settings.short_name} onChange={e=>setSettings(s=>({...s,short_name:e.target.value}))} maxLength={40} required /></Field>
          <Field label="Tagline"><input value={settings.tagline} onChange={e=>setSettings(s=>({...s,tagline:e.target.value}))} maxLength={160} required /></Field>
          <Field label="Warna utama"><input type="color" value={settings.primary_color} onChange={e=>setSettings(s=>({...s,primary_color:e.target.value}))} /></Field>
          <Button disabled={busy}>{busy?'Menyimpan…':'Simpan identitas'}</Button>
        </form>
      </Card>

      <Card className="admin-login-card">
        <div className="section-head"><div><span className="eyebrow">Login</span><h3>Tampilan halaman masuk</h3></div></div>
        <form onSubmit={save} className="stack-form">
          <Field label="Judul login"><input value={settings.login_title} onChange={e=>setSettings(s=>({...s,login_title:e.target.value}))} maxLength={220} required /></Field>
          <Field label="Deskripsi login"><textarea rows={4} value={settings.login_description} onChange={e=>setSettings(s=>({...s,login_description:e.target.value}))} maxLength={320} required /></Field>
          <Button disabled={busy}>{busy?'Menyimpan…':'Simpan tampilan login'}</Button>
        </form>
      </Card>

      <Card className="admin-status-card">
        <div className="section-head"><div><span className="eyebrow">System status</span><h3>Konfigurasi production</h3></div><Badge tone="info">Read-only</Badge></div>
        <div className="admin-status-grid">
          <div><small>Supabase client</small><strong>{SUPABASE_CONFIGURED && supabase ? 'Terkonfigurasi' : 'Belum siap'}</strong></div>
          <div><small>Turnstile</small><strong>{CAPTCHA_REQUIRED && CAPTCHA_CONFIGURED ? 'Aktif' : CAPTCHA_REQUIRED ? 'Belum siap' : 'Opsional'}</strong></div>
          <div><small>Turnstile key</small><strong>{CAPTCHA_CONFIGURED ? `${TURNSTILE_SITE_KEY.slice(0,10)}…` : 'Kosong'}</strong></div>
          <div><small>VAPID</small><strong>{VAPID_PUBLIC_KEY ? 'Tersedia' : 'Kosong'}</strong></div>
        </div>
        <p className="muted">Site key, VAPID public key, dan status koneksi hanya ditampilkan untuk pengecekan. Secret key tetap berada di server/Supabase.</p>
      </Card>
    </div>
  </div>;
}
