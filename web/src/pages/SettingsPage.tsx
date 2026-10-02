import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Card, Field } from '../components/ui';
import { clearLocalData, queueAll, queueRetry, queueRemove } from '../lib/offline';
import { getProfile, updateProfile } from '../lib/repository';
import type { Profile, SyncQueueItem } from '../types/models';
import { showToast } from '../components/ToastHost';
import { DEMO_MODE, supabase } from '../lib/supabase';
import { nav } from '../lib/router';
import { enablePushNotifications, disablePushNotifications, getPushState, sendPushTest, updatePushPreferences, type PushState } from '../lib/push';
import { isSystemAdmin } from '../lib/app-settings';

const NOTIFICATION_PREF_KEY='inside-code-notification-preferences';
const LEGACY_NOTIFICATION_PREF_KEY='student-hub-notification-preferences';
const NOTIFICATION_TYPES=[['assignment','Tugas'],['schedule','Jadwal'],['forum','Forum'],['material','Materi'],['announcement','Pengumuman'],['cash','Kas'],['group','Kelompok'],['poll','Polling'],['documentation','Dokumentasi'],['system','Sistem']] as const;
const DEFAULT_NOTIFICATION_PREFS:Record<string,boolean>=Object.fromEntries(NOTIFICATION_TYPES.map(([key])=>[key,true]));
function readNotificationPrefs(){try{const raw=localStorage.getItem(NOTIFICATION_PREF_KEY)||localStorage.getItem(LEGACY_NOTIFICATION_PREF_KEY)||'';const parsed={...DEFAULT_NOTIFICATION_PREFS,...JSON.parse(raw||'{}')} as Record<string,boolean>;if(!localStorage.getItem(NOTIFICATION_PREF_KEY)&&raw)try{localStorage.setItem(NOTIFICATION_PREF_KEY,JSON.stringify(parsed))}catch{};return parsed}catch{return DEFAULT_NOTIFICATION_PREFS}}
function pushErrorMessage(error: unknown){
 const code=error instanceof Error?error.message:String(error);
 const messages:Record<string,string>={
  BROWSER_PUSH_NOT_SUPPORTED:'Browser ini belum mendukung Web Push.',
  PUSH_REQUIRES_HTTPS:'Notifikasi sistem membutuhkan HTTPS. localhost tetap bisa digunakan untuk pengujian browser tertentu.',
  VAPID_PUBLIC_KEY_NOT_CONFIGURED:'VAPID public key belum dikonfigurasi pada build production.',
  SUPABASE_NOT_CONFIGURED:'Supabase belum dikonfigurasi.',
  PUSH_PERMISSION_DENIED:'Izin notifikasi ditolak. Aktifkan kembali dari pengaturan notifikasi browser/perangkat.',
  PUSH_PERMISSION_NOT_GRANTED:'Izin notifikasi belum diberikan.',
  PUSH_SUBSCRIPTION_INVALID:'Data subscription push dari browser tidak lengkap.',
  PUSH_USE_PREVIEW_BUILD:'Push sistem diuji pada build production/preview. Jalankan npm run build lalu npm run preview.',
 };
 return messages[code]||code||'Gagal mengatur notifikasi perangkat.';
}

export function SettingsPage(){
 const [profile,setProfile]=useState<Profile|null>(null);const [message,setMessage]=useState('');const [error,setError]=useState('');const [saving,setSaving]=useState(false);const [queue,setQueue]=useState<SyncQueueItem[]>([]);const [notificationPrefs,setNotificationPrefs]=useState<Record<string,boolean>>(()=>readNotificationPrefs());
 const [systemAdmin,setSystemAdmin]=useState(false); const [pushState,setPushState]=useState<PushState|null>(null);const [pushBusy,setPushBusy]=useState(false);const [pushMessage,setPushMessage]=useState('');const [pushError,setPushError]=useState('');
 const refreshQueue=async()=>setQueue(await queueAll());
 const refreshPush=async()=>setPushState(await getPushState().catch(()=>null));
 const updateNotificationPref=async(key:string,value:boolean)=>{const next={...notificationPrefs,[key]:value};setNotificationPrefs(next);localStorage.setItem(NOTIFICATION_PREF_KEY,JSON.stringify(next));setMessage('Preferensi notifikasi disimpan.');try{await updatePushPreferences(next)}catch(e){setPushError(pushErrorMessage(e))}};
 useEffect(()=>{getProfile().then(setProfile).catch(e=>setError(e instanceof Error?e.message:'Gagal memuat profil.'));void refreshQueue();void refreshPush();void isSystemAdmin().then(setSystemAdmin)},[]);
 const logout=async()=>{if(!DEMO_MODE&&supabase)await supabase.auth.signOut();await clearLocalData();nav('/dashboard');location.reload()};
 const save=async(e:FormEvent)=>{e.preventDefault();if(!profile)return;setSaving(true);setError('');setMessage('');try{const p=await updateProfile({full_name:profile.full_name,nim:profile.nim,major:profile.major,semester:profile.semester});setProfile(p);setMessage('Profil berhasil diperbarui.');showToast('Profil berhasil diperbarui.','good')}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan profil.')}finally{setSaving(false)}};
 const enablePush=async()=>{setPushBusy(true);setPushError('');setPushMessage('');try{if(DEMO_MODE)throw new Error('PUSH_REQUIRES_REAL_SUPABASE');await enablePushNotifications(notificationPrefs);await refreshPush();setPushMessage('Notifikasi perangkat berhasil diaktifkan.');showToast('Notifikasi perangkat aktif.','good')}catch(e){setPushError(e instanceof Error&&e.message==='PUSH_REQUIRES_REAL_SUPABASE'?'Mode demo tidak dapat mendaftarkan push production. Gunakan build dengan Supabase aktif.':pushErrorMessage(e))}finally{setPushBusy(false)}};
 const disablePush=async()=>{setPushBusy(true);setPushError('');setPushMessage('');try{await disablePushNotifications();await refreshPush();setPushMessage('Notifikasi perangkat dinonaktifkan pada perangkat ini.');showToast('Notifikasi perangkat dimatikan.','info')}catch(e){setPushError(pushErrorMessage(e))}finally{setPushBusy(false)}};
 const testPush=async()=>{setPushBusy(true);setPushError('');setPushMessage('');try{const result=await sendPushTest();await refreshPush();if(result.sent>0){setPushMessage('Notifikasi tes dikirim. Periksa notification tray perangkat.')}else if(result.attempted===0){setPushError('Belum ada perangkat yang terdaftar untuk menerima push. Aktifkan notifikasi terlebih dahulu.')}else{setPushError(`Push gagal dikirim ke ${result.failed} perangkat.`)}}catch(e){setPushError(pushErrorMessage(e))}finally{setPushBusy(false)}};
 const pushStatus=pushState?.subscribed&&pushState.permission==='granted';
 return <div className="stack-page">
  {error&&<div className="alert alert-danger" role="alert">{error}</div>}{message&&<div className="alert alert-info" role="status">{message}</div>}
  <div className="page-title"><div><span className="eyebrow">Account</span><h2>Pengaturan</h2><p>Edit profil, kelola notifikasi perangkat, inspeksi outbox, dan data offline di perangkat ini.</p></div></div>
  <div className="grid-2">
   <Card><h3>Profil mahasiswa</h3><form onSubmit={save} className="stack-form"><Field label="Nama lengkap"><input value={profile?.full_name??''} onChange={e=>setProfile(p=>p?{...p,full_name:e.target.value}:p)} required maxLength={160}/></Field><Field label="NIM"><input value={profile?.nim??''} onChange={e=>setProfile(p=>p?{...p,nim:e.target.value}:p)}/></Field><Field label="Program studi"><input value={profile?.major??''} onChange={e=>setProfile(p=>p?{...p,major:e.target.value}:p)}/></Field><Field label="Semester"><input type="number" min="1" max="20" value={profile?.semester??''} onChange={e=>setProfile(p=>p?{...p,semester:e.target.value?Number(e.target.value):null}:p)}/></Field><Button disabled={saving}>{saving?'Menyimpan…':'Simpan profil'}</Button></form></Card>
   <Card><h3>Data offline</h3><p className="muted">Cache lokal dapat dihapus tanpa menghapus data server. Antrean yang belum tersinkron dapat dicoba ulang atau dibuang satu per satu.</p><div className="button-row"><Button variant="danger" onClick={async()=>{await clearLocalData();setQueue([]);setMessage('Cache dan outbox lokal dihapus.');showToast('Data lokal dibersihkan.','good')}}>Bersihkan semua</Button><Button variant="soft" onClick={()=>void refreshQueue()}>Muat ulang outbox</Button></div></Card>
  </div>

  <Card className="notification-device-card">
    <div className="section-head"><div><span className="eyebrow">Notifikasi perangkat</span><h3>Notifikasi di luar aplikasi</h3></div><Badge tone={pushStatus?'good':'warn'}>{pushStatus?'Aktif':'Belum aktif'}</Badge></div>
    <p className="muted">Dengan ini Inside Code dapat menampilkan notifikasi sistem saat aplikasi sedang di-background atau tidak sedang dibuka. Izin selalu diminta lewat tombol di bawah.</p>
    {pushState?.iosHomeScreenRequired&&<div className="alert alert-info" role="status">Di iPhone/iPad, tambahkan Inside Code ke Layar Utama dan buka sebagai Web App sebelum mengaktifkan push.</div>}
    {pushState&&!pushState.secureContext&&<div className="alert alert-danger" role="alert">Web Push membutuhkan koneksi HTTPS pada deployment.</div>}
    {pushError&&<div className="alert alert-danger" role="alert">{pushError}</div>}{pushMessage&&<div className="alert alert-info" role="status">{pushMessage}</div>}
    <div className="push-status-grid">
      <div><small>Browser</small><strong>{pushState?.supported?'Didukung':'Tidak didukung'}</strong></div>
      <div><small>Izin</small><strong>{pushState?.permission==='granted'?'Diizinkan':pushState?.permission==='denied'?'Ditolak':'Belum diminta'}</strong></div>
      <div><small>VAPID</small><strong>{pushState?.vapidConfigured?'Siap':'Belum dikonfigurasi'}</strong></div>
    </div>
    <div className="button-row push-action-row">
      {!pushStatus?<Button disabled={pushBusy||DEMO_MODE} onClick={()=>void enablePush()}>{pushBusy?'Menyiapkan…':'Aktifkan notifikasi perangkat'}</Button>:<Button variant="soft" disabled={pushBusy} onClick={()=>void testPush()}>{pushBusy?'Mengirim…':'Kirim notifikasi tes'}</Button>}
      {pushStatus&&<Button variant="danger" disabled={pushBusy} onClick={()=>void disablePush()}>Nonaktifkan</Button>}
    </div>
    {DEMO_MODE&&<small className="muted">Mode demo hanya menampilkan alur UI. Push sungguhan aktif setelah build production terhubung ke Supabase.</small>}
  </Card>

  <Card className="notification-preferences"><div className="section-head"><div><span className="eyebrow">Notifikasi</span><h3>Preferensi popup & push</h3></div><Badge tone="info">Popup + Sistem</Badge></div><p className="muted">Atur jenis notifikasi yang diizinkan. Preferensi yang tersimpan akan dipakai untuk popup dalam aplikasi dan, bila push aktif, untuk notifikasi sistem.</p><div className="preference-grid">{NOTIFICATION_TYPES.map(([key,label])=><label className="preference-row" key={key}><span>{label}</span><input type="checkbox" checked={notificationPrefs[key]!==false} onChange={e=>void updateNotificationPref(key,e.target.checked)} aria-label={`Notifikasi ${label}`}/></label>)}</div></Card>

  {systemAdmin&&<Card className="settings-admin-card"><div className="section-head"><div><span className="eyebrow">Administrator</span><h3>Branding & pengaturan aplikasi</h3></div><Badge tone="info">Admin</Badge></div><p className="muted">Atur nama aplikasi, logo, tampilan login, dan warna utama tanpa mengedit source code.</p><div className="button-row"><Button onClick={()=>nav('/admin')}>Buka panel admin</Button></div></Card>}

  <Card className="settings-security-card"><div className="section-head"><div><span className="eyebrow">Keamanan</span><h3>Perlindungan akun</h3></div><Badge tone="good">CAPTCHA · MFA</Badge></div><p className="muted">Kelola CAPTCHA login, status verifikasi dua langkah, sesi aktif, dan pemeriksaan keamanan akun.</p><div className="settings-action-list"><button onClick={()=>nav('/security')}><span>◈</span><div><strong>Buka pusat keamanan</strong><small>Kelola MFA dan lihat status perlindungan akun.</small></div><b>›</b></button></div></Card>

  <Card className="settings-app-card"><div className="section-head"><div><span className="eyebrow">Aplikasi</span><h3>Inside Code di perangkat</h3></div><Badge tone="info">PWA</Badge></div><div className="settings-action-list"><button onClick={()=>window.dispatchEvent(new Event('inside-code-sw-check'))}><span>↻</span><div><strong>Periksa pembaruan</strong><small>Muat ulang saat versi baru tersedia.</small></div><b>›</b></button><button onClick={()=>showToast('Gunakan menu browser “Install app” atau ikon pasang di address bar untuk memasang Inside Code.','info') }><span>＋</span><div><strong>Install Inside Code</strong><small>Tambahkan aplikasi ke layar utama.</small></div><b>›</b></button><div className="settings-about"><strong>Inside Code</strong><small>Mobile-first class workspace · v1.8.4</small></div></div></Card>
  <Card className="settings-ux-card"><div className="section-head"><div><span className="eyebrow">Navigasi</span><h3>Workspace aktif</h3></div><Badge tone="info">Konteks kelas</Badge></div><p className="muted">Inside Code mengingat kelas terakhir yang kamu buka agar Tugas, Jadwal, Kas, Dokumentasi, dan Randomizer tetap berada pada konteks yang sama.</p><div className="button-row"><Button variant="soft" onClick={()=>nav('/classes')}>Pilih kelas</Button><Button variant="ghost" onClick={()=>nav('/quick-messages')}>Pesan cepat</Button></div></Card>
  <Card><div className="section-head"><div><span className="eyebrow">Outbox</span><h3>Mutasi offline</h3></div><Badge tone={queue.length?'warn':'good'}>{queue.length} item</Badge></div>{queue.length?queue.map(item=><div className="queue-row" key={item.operationId}><div><strong>{item.operation} · {item.table}</strong><small>{item.operationId.slice(0,8)} · percobaan {item.attempts} · {item.status}</small>{item.lastError&&<p>{item.lastError}</p>}</div><div className="button-row">{item.status!=='pending'&&<Button variant="soft" onClick={()=>void queueRetry(item.operationId).then(refreshQueue)}>Coba lagi</Button>}<Button variant="ghost" onClick={()=>void queueRemove(item.operationId).then(refreshQueue)}>Buang</Button></div></div>):<div className="empty"><strong>Outbox kosong</strong><span>Semua mutasi sudah tersinkron atau belum ada perubahan offline.</span></div>}</Card>
  <Card className="settings-account-actions"><div className="section-head"><div><span className="eyebrow">Akun</span><h3>Sesi login</h3></div><Badge tone="good">Aktif</Badge></div><p className="muted">Sesi autentikasi aktif. Keluar akan mengakhiri sesi dan membersihkan cache serta outbox lokal Inside Code.</p><Button variant="danger" onClick={()=>void logout()}>Keluar dari akun</Button></Card>
 </div>;
}
