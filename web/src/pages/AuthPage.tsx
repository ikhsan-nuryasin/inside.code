import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field } from '../components/ui';
import { DEMO_MODE, requireSupabase } from '../lib/supabase';
import { nav } from '../lib/router';
import { TurnstileCaptcha } from '../components/TurnstileCaptcha';
import { CAPTCHA_REQUIRED, CAPTCHA_CONFIGURED } from '../lib/captcha';
import { clearAuthFailures, getAuthLock, recordAuthFailure } from '../lib/auth-guard';
import { DEFAULT_APP_SETTINGS, getAppSettings, type AppSettings } from '../lib/app-settings';

export function AuthPage({onDone}:{onDone:()=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [info,setInfo]=useState(''); const [captchaToken,setCaptchaToken]=useState(''); const [captchaReset,setCaptchaReset]=useState(0);
 const [lockedUntil,setLockedUntil]=useState(0);
 const [appSettings,setAppSettings]=useState<AppSettings>(DEFAULT_APP_SETTINGS);
 const refreshLock=useCallback(()=>setLockedUntil(getAuthLock(email.trim().toLowerCase())),[email]);
 useEffect(()=>{refreshLock();},[refreshLock]);
 useEffect(()=>{void getAppSettings().then(setAppSettings);},[]);
 useEffect(()=>{if(!lockedUntil)return;const id=window.setInterval(()=>{const next=getAuthLock(email.trim().toLowerCase());setLockedUntil(next);if(!next)window.clearInterval(id)},1000);return()=>window.clearInterval(id)},[lockedUntil,email]);
 const handleCaptcha=useCallback((token:string)=>setCaptchaToken(token),[]);
 const switchMode=(next:'login'|'register')=>{setMode(next);setError('');setInfo('');setCaptchaToken('');setCaptchaReset(v=>v+1);};
 const submit=async(e:FormEvent)=>{
   e.preventDefault(); setBusy(true); setError(''); setInfo('');
   const normalizedEmail=email.trim().toLowerCase();
   try{
     if(DEMO_MODE){ onDone(); nav('/dashboard'); return; }
     const lock=getAuthLock(normalizedEmail); if(lock){setLockedUntil(lock); throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((lock-Date.now())/60000)} menit.`)}
     if(CAPTCHA_REQUIRED && !CAPTCHA_CONFIGURED) throw new Error('CAPTCHA belum dikonfigurasi di build production. Hubungi administrator.');
     if(CAPTCHA_REQUIRED && !captchaToken) throw new Error('Selesaikan verifikasi keamanan terlebih dahulu.');
     const s=requireSupabase();
     if(mode==='login'){
       const {data,error}=await s.auth.signInWithPassword({email:normalizedEmail,password,options:{captchaToken:captchaToken||undefined}});
       if(error){
         const msg = String(error.message || '').toLowerCase();
         if(error.status===429 || msg.includes('rate limit') || msg.includes('too many requests')){
           throw new Error('Terlalu banyak percobaan. Coba lagi beberapa saat kemudian.');
         }
         if(msg.includes('captcha') || msg.includes('turnstile') || msg.includes('challenge')){
           throw new Error('Verifikasi CAPTCHA gagal. Pastikan CAPTCHA selesai dan konfigurasi Turnstile di Cloudflare/Supabase sudah benar.');
         }
         if(msg.includes('email not confirmed')){
           setInfo('Email akun belum terverifikasi. Cek inbox email sebelum mencoba masuk kembali.');
           return;
         }
         const invalidCredentials = msg.includes('invalid login credentials') || msg.includes('invalid email or password') || msg.includes('invalid credentials');
         if(!invalidCredentials){
           throw new Error('Layanan login sedang bermasalah. Silakan coba lagi beberapa saat.');
         }
         const locked=recordAuthFailure(normalizedEmail);
         if(locked){setLockedUntil(locked);throw new Error('Terlalu banyak percobaan login gagal. Akun/perangkat dikunci sementara.');}
         throw new Error('Email atau password salah.');
       }
       clearAuthFailures(normalizedEmail);
       if(!data.user?.email_confirmed_at){
         await s.auth.signOut({scope:'local'}).catch(()=>{});
         setInfo('Email akun belum terverifikasi. Cek inbox email sebelum mencoba masuk kembali.');
         return;
       }
       onDone();
     }else{
       if(password.length < 12) throw new Error('Untuk akun baru, gunakan password minimal 12 karakter.');
       if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password)) throw new Error('Password harus mengandung huruf besar, huruf kecil, angka, dan simbol.');
       if(name.trim().length < 2) throw new Error('Nama lengkap wajib diisi.');
       const {data,error}=await s.auth.signUp({email:normalizedEmail,password,options:{captchaToken:captchaToken||undefined,data:{full_name:name.trim()}}});
       if(error){
         const msg=error.message.toLowerCase();
         if(msg.includes('already registered')||msg.includes('already exists')) { setInfo('Jika alamat email dapat digunakan, instruksi pendaftaran/verifikasi akan tersedia di email tersebut.'); return; }
         throw new Error('Pendaftaran tidak dapat diproses saat ini.');
       }
       clearAuthFailures(normalizedEmail);
       if(data.session && data.user?.email_confirmed_at){onDone();}else setInfo('Akun dibuat. Cek email untuk verifikasi sebelum login.');
     }
   }catch(err){setError(err instanceof Error?err.message:'Terjadi kesalahan.');}
   finally{setBusy(false);setCaptchaToken('');setCaptchaReset(v=>v+1);}
 };
 const reset=async()=>{
   setError('');setInfo('');
   if(DEMO_MODE){setInfo('Demo mode tidak membutuhkan reset password.');return;}
   if(!email.trim()){setError('Masukkan email akun terlebih dahulu.');return;}
   if(CAPTCHA_REQUIRED&&!captchaToken){setError('Selesaikan verifikasi keamanan terlebih dahulu.');return;}
   try{
    const {error}=await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:`${location.origin}/#/update-password`,captchaToken:captchaToken||undefined});
    if(error)throw error;
    setInfo('Jika email terdaftar, instruksi reset password akan dikirim.');
   }catch(err){
     const msg = err instanceof Error ? err.message.toLowerCase() : '';
     if(msg.includes('captcha') || msg.includes('turnstile') || msg.includes('challenge')) setError('Verifikasi CAPTCHA gagal. Selesaikan CAPTCHA lalu coba lagi.');
     else setError('Permintaan reset tidak dapat diproses saat ini.');
   }
   finally{setCaptchaToken('');setCaptchaReset(v=>v+1);}
 };
 const remainingMinutes=lockedUntil?Math.max(1,Math.ceil((lockedUntil-Date.now())/60000)):0;
 return <div className="auth-layout">
   <div className="auth-hero"><div className="hero-mark"><img src={appSettings.logo_url||'/icon.svg'} alt={appSettings.app_name} /></div><span className="eyebrow">{appSettings.app_name} · Mahasiswa</span><h1>{appSettings.login_title}</h1><p>{appSettings.login_description}</p><div className="hero-bullets"><span>Session aman</span><span>CAPTCHA & rate limit</span><span>Mahasiswa-only</span></div></div>
   <Card className="auth-card">
     <div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>Masuk</button><button className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>Daftar</button></div>
     <div className="auth-card-head"><h2>{mode==='login'?'Selamat datang kembali':`Buat akun ${appSettings.app_name}`}</h2><p>{mode==='login'?'Gunakan email dan password akun kamu.':'Daftar dengan email aktif yang bisa kamu verifikasi.'}</p></div>
     <form onSubmit={submit} className="stack-form">
       {mode==='register'&&<Field label="Nama lengkap"><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required placeholder="Nama lengkap" maxLength={150}/></Field>}
       <Field label="Email akun"><input autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nama@email.com"/></Field>
       <Field label="Password"><input autoComplete={mode==='login'?'current-password':'new-password'} type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode==='register'?12:8} placeholder={mode==='register'?'Minimal 12 karakter':'Minimal 8 karakter'}/></Field>
       {mode==='register'&&<small className="password-hint">Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol. Jangan gunakan password dari layanan lain.</small>}
       {mode==='login'&&<button type="button" className="inline-link" onClick={()=>void reset()}>Lupa password?</button>}
       {!DEMO_MODE&&<TurnstileCaptcha onToken={handleCaptcha} resetKey={captchaReset} action={mode==='login'?'login':'signup'}/>}
       {lockedUntil&&<div className="alert alert-warning" role="alert">Login sementara dikunci. Coba lagi sekitar {remainingMinutes} menit.</div>}
       {error&&<div className="alert alert-danger" role="alert">{error}</div>}
       {info&&<div className="alert alert-info" role="status">{info}</div>}
       <Button type="submit" disabled={busy||Boolean(lockedUntil)}>{busy?'Memproses…':mode==='login'?'Masuk':'Buat akun'}</Button>
       <p className="auth-security-note">Autentikasi dilindungi Supabase Auth, rate limit, dan CAPTCHA. Aplikasi tidak menyimpan password mentah.</p>
       {DEMO_MODE&&<p className="demo-note">Demo mode aktif. CAPTCHA production tidak diperlukan.</p>}
     </form>
   </Card>
 </div>;
}
