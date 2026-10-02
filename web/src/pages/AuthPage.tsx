import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field } from '../components/ui';
import { ToastHost, showToast } from '../components/ToastHost';
import { requireSupabase } from '../lib/supabase';
import { nav } from '../lib/router';
import { TurnstileCaptcha } from '../components/TurnstileCaptcha';
import { CAPTCHA_REQUIRED, CAPTCHA_CONFIGURED } from '../lib/captcha';
import { clearAuthFailures, getAuthLock, recordAuthFailure } from '../lib/auth-guard';
import { DEFAULT_APP_SETTINGS, getAppSettings, type AppSettings } from '../lib/app-settings';

type PasswordRules = {
  length8: boolean;
  lower: boolean;
  upper: boolean;
  number: boolean;
  symbol: boolean;
};

// Advisory only. Supabase Auth is the authoritative password policy.
function getPasswordRules(value: string): PasswordRules {
  return {
    length8: value.length >= 8,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}


function friendlyAuthError(error: unknown, mode: 'login'|'register'): string {
 const value = error as { message?: string; code?: string; status?: number } | null;
 const message = String(value?.message ?? '').trim();
 const msg = message.toLowerCase();
 const code = String(value?.code ?? '').toLowerCase();
 if(value?.status===429 || msg.includes('rate limit') || msg.includes('too many requests') || code.includes('rate_limit')) return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
 if(code==='captcha_failed' || msg.includes('captcha') || msg.includes('turnstile') || msg.includes('challenge')) return 'Verifikasi keamanan gagal. Selesaikan Turnstile lalu coba lagi.';
 if(code==='weak_password' || msg.includes('weak password') || msg.includes('password is too weak')) return 'Password belum memenuhi kebijakan keamanan. Gunakan password yang lebih kuat.';
 if(code==='email_address_invalid' || msg.includes('invalid email')) return 'Format alamat email tidak valid. Periksa kembali email kamu.';
 if(code==='email_address_not_authorized' || msg.includes('email address not authorized')) return 'Email verifikasi tidak dapat dikirim ke alamat ini. Periksa konfigurasi SMTP dan domain pengirim.';
 if(code==='signup_disabled' || msg.includes('signups not allowed') || msg.includes('signup is disabled')) return 'Pendaftaran akun sedang dinonaktifkan.';
 if(msg.includes('error sending confirmation email') || msg.includes('failed to send confirmation email')) return 'Akun belum dapat menyelesaikan pendaftaran karena email verifikasi gagal dikirim. Periksa SMTP dan coba lagi.';
 if(code==='database_error' || msg.includes('database error saving new user') || msg.includes('row-level security')) return 'Server gagal menyimpan akun. Coba lagi beberapa saat kemudian.';
 if(code==='email_exists' || msg.includes('already registered') || msg.includes('user already registered') || msg.includes('already exists')) return 'Email ini sudah terdaftar. Silakan masuk menggunakan akun tersebut.';
 if(msg.includes('invalid login credentials') || msg.includes('invalid email or password') || msg.includes('invalid credentials')) return 'Email atau password yang dimasukkan salah.';
 if(message) return `${mode==='register'?'Pendaftaran':'Login'} gagal. Kode: ${code || value?.status || 'AUTH_ERROR'}.`;
 return mode==='register'?'Pendaftaran gagal. Coba lagi beberapa saat kemudian.':'Login gagal. Coba lagi beberapa saat kemudian.';
}

export function AuthPage({onDone}:{onDone:()=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [info,setInfo]=useState(''); const [captchaToken,setCaptchaToken]=useState(''); const [captchaReset,setCaptchaReset]=useState(0);
 const [verificationNeeded,setVerificationNeeded]=useState(false); const [resendBusy,setResendBusy]=useState(false);
 const [lockedUntil,setLockedUntil]=useState(0);
 const [appSettings,setAppSettings]=useState<AppSettings>(DEFAULT_APP_SETTINGS);
 const refreshLock=useCallback(()=>setLockedUntil(getAuthLock(email.trim().toLowerCase())),[email]);
 useEffect(()=>{refreshLock();},[refreshLock]);
useEffect(()=>{if(error)showToast(error,'danger',mode==='register'?'Pendaftaran gagal':'Login gagal');},[error,mode]);
useEffect(()=>{if(info)showToast(info,verificationNeeded?'warn':'good',verificationNeeded?'Perlu tindakan':'Berhasil');},[info,verificationNeeded]);
 useEffect(()=>{void getAppSettings().then(setAppSettings);},[]);
 useEffect(()=>{if(!lockedUntil)return;const id=window.setInterval(()=>{const next=getAuthLock(email.trim().toLowerCase());setLockedUntil(next);if(!next)window.clearInterval(id)},1000);return()=>window.clearInterval(id)},[lockedUntil,email]);
 const handleCaptcha=useCallback((token:string)=>setCaptchaToken(token),[]);
 const switchMode=(next:'login'|'register')=>{setMode(next);setError('');setInfo('');setVerificationNeeded(false);setCaptchaToken('');setCaptchaReset(v=>v+1);};
 const registerPasswordRules = getPasswordRules(password);
 useEffect(()=>{
   const hash=window.location.hash.replace(/^#/,'');
   const params=new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
   const errorCode=params.get('error_code');
   const errorType=params.get('error');
   if(errorCode==='otp_expired' || (errorType==='access_denied' && params.get('error_description')?.toLowerCase().includes('expired'))){
     setVerificationNeeded(true);
     setError('Link verifikasi email sudah kedaluwarsa atau sudah digunakan. Kirim email verifikasi baru untuk melanjutkan.');
     window.history.replaceState({},document.title,window.location.pathname+window.location.search);
   }
 },[]);
 const resendVerification=async()=>{
   setError(''); setInfo('');
   const targetEmail=email.trim().toLowerCase();
   if(!targetEmail){setError('Masukkan email akun terlebih dahulu.');return;}
   if(CAPTCHA_REQUIRED&&!captchaToken){setError('Selesaikan verifikasi keamanan terlebih dahulu.');return;}
   setResendBusy(true);
   try{
     const {error}=await requireSupabase().auth.resend({type:'signup',email:targetEmail,options:{emailRedirectTo:window.location.origin,captchaToken:captchaToken||undefined}});
     if(error) throw error;
     setVerificationNeeded(true);
     setInfo('Email verifikasi baru sudah diminta. Gunakan link terbaru dari inbox, lalu buka di perangkat yang sama.');
   }catch(err){
     const msg=err instanceof Error?err.message.toLowerCase():'';
     if(msg.includes('captcha')||msg.includes('turnstile')||msg.includes('challenge')) setError('Verifikasi CAPTCHA gagal. Selesaikan CAPTCHA lalu coba lagi.');
     else if(msg.includes('rate limit')||msg.includes('too many requests')) setError('Terlalu banyak permintaan email. Tunggu beberapa saat lalu coba lagi.');
     else setError('Email verifikasi baru tidak dapat dikirim saat ini.');
   }finally{setResendBusy(false);setCaptchaToken('');setCaptchaReset(v=>v+1);}
 };
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
   e.preventDefault(); setBusy(true); setError(''); setInfo('');

   // Read the submitted DOM form values, not only React state. This prevents
   // browser/password-manager autofill from validating a stale state value.
   const formData = new FormData(e.currentTarget);
   const submittedName = String(formData.get('fullName') ?? '').trim();
   const submittedEmail = String(formData.get('email') ?? '').trim().toLowerCase();
   const submittedPassword = String(formData.get('password') ?? '');
   setName(submittedName);
   setEmail(submittedEmail);
   setPassword(submittedPassword);

   try{
     const lock=getAuthLock(submittedEmail); if(lock){setLockedUntil(lock); throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((lock-Date.now())/60000)} menit.`)}
     if(CAPTCHA_REQUIRED && !CAPTCHA_CONFIGURED) throw new Error('CAPTCHA belum dikonfigurasi di build production. Hubungi administrator.');
     if(CAPTCHA_REQUIRED && !captchaToken) throw new Error('Selesaikan verifikasi keamanan terlebih dahulu.');
     const s=requireSupabase();
     if(mode==='login'){
       const {data,error}=await s.auth.signInWithPassword({email:submittedEmail,password:submittedPassword,options:{captchaToken:captchaToken||undefined}});
       if(error){
         const msg = String(error.message || '').toLowerCase();
         if(error.status===429 || msg.includes('rate limit') || msg.includes('too many requests')){
           throw new Error('Terlalu banyak percobaan. Coba lagi beberapa saat kemudian.');
         }
         if(msg.includes('captcha') || msg.includes('turnstile') || msg.includes('challenge')){
           throw new Error('Verifikasi CAPTCHA gagal. Pastikan CAPTCHA selesai dan konfigurasi Turnstile di Cloudflare/Supabase sudah benar.');
         }
         if(error.code==='weak_password' || msg.includes('weak password') || msg.includes('password is too weak')){
           throw new Error('Password akun ditolak oleh kebijakan keamanan Supabase. Gunakan “Lupa password?” untuk membuat password baru yang memenuhi kebijakan server.');
         }
         if(msg.includes('email not confirmed')){
           setVerificationNeeded(true);
           setInfo('Email akun belum terverifikasi. Cek inbox email atau kirim ulang email verifikasi terbaru.');
           return;
         }
         const invalidCredentials = msg.includes('invalid login credentials') || msg.includes('invalid email or password') || msg.includes('invalid credentials');
         if(!invalidCredentials){
           throw new Error(friendlyAuthError(error,'login'));
         }
         const locked=recordAuthFailure(submittedEmail);
         if(locked){setLockedUntil(locked);throw new Error('Terlalu banyak percobaan login gagal. Akun/perangkat dikunci sementara.');}
         throw new Error('Email atau password salah.');
       }
       clearAuthFailures(submittedEmail);
       if(!data.user?.email_confirmed_at){
         await s.auth.signOut({scope:'local'}).catch(()=>{});
         setVerificationNeeded(true);
         setInfo('Email akun belum terverifikasi. Cek inbox email atau kirim ulang email verifikasi terbaru.');
         return;
       }
       onDone();
     }else{
       if(submittedName.length < 2) throw new Error('Nama lengkap wajib diisi.');
       const {data,error}=await s.auth.signUp({email:submittedEmail,password:submittedPassword,options:{captchaToken:captchaToken||undefined,emailRedirectTo:window.location.origin,data:{full_name:submittedName}}});
       if(error){
         const msg=String(error.message || '').toLowerCase();
         if(error.code==='weak_password' || msg.includes('weak password') || msg.includes('password is too weak')){
           throw new Error('Password ditolak oleh kebijakan keamanan Supabase. Coba password yang lebih panjang/kuat dan gunakan kombinasi karakter yang berbeda.');
         }
         if(msg.includes('captcha') || msg.includes('turnstile') || msg.includes('challenge')){
           throw new Error('Verifikasi CAPTCHA gagal. Selesaikan CAPTCHA lalu coba lagi.');
         }
         if(error.status===429 || msg.includes('rate limit') || msg.includes('too many requests')){
           throw new Error('Terlalu banyak percobaan. Coba lagi beberapa saat kemudian.');
         }
         if(msg.includes('already registered')||msg.includes('already exists')) { setInfo('Jika alamat email dapat digunakan, instruksi pendaftaran/verifikasi akan tersedia di email tersebut.'); return; }
         throw new Error(friendlyAuthError(error,'register'));
       }
       clearAuthFailures(submittedEmail);
       if(data.session && data.user?.email_confirmed_at){onDone();}else{setVerificationNeeded(true);setInfo('Akun dibuat. Cek email untuk verifikasi sebelum login. Jika link kedaluwarsa, gunakan tombol kirim ulang.');}
     }
   }catch(err){setError(err instanceof Error?err.message:'Terjadi kesalahan.');}
   finally{setBusy(false);setCaptchaToken('');setCaptchaReset(v=>v+1);}
 };
 const reset=async()=>{
   setError('');setInfo('');
   if(!email.trim()){setError('Masukkan email akun terlebih dahulu.');return;}
   if(CAPTCHA_REQUIRED&&!captchaToken){setError('Selesaikan verifikasi keamanan terlebih dahulu.');return;}
   try{
    const {error}=await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:`${location.origin}/#/update-password`,captchaToken:captchaToken||undefined});
    if(error)throw error;
    setInfo('Jika email terdaftar, instruksi reset password akan dikirim.');
   }catch(err){
     const msg = err instanceof Error ? err.message.toLowerCase() : '';
     if(msg.includes('captcha') || msg.includes('turnstile') || msg.includes('challenge')) setError('Verifikasi CAPTCHA gagal. Selesaikan CAPTCHA lalu coba lagi.');
     else setError(friendlyAuthError(err,'login'));
   }
   finally{setCaptchaToken('');setCaptchaReset(v=>v+1);}
 };
 const remainingMinutes=lockedUntil?Math.max(1,Math.ceil((lockedUntil-Date.now())/60000)):0;
 return <><ToastHost/><div className="auth-layout">
   <div className="auth-hero"><div className="hero-mark"><img src={appSettings.logo_url||'/icon.svg'} alt={appSettings.app_name} /></div><span className="eyebrow">{appSettings.app_name} · Mahasiswa</span><h1>{appSettings.login_title}</h1><p>{appSettings.login_description}</p><div className="hero-bullets"><span>Session aman</span><span>CAPTCHA & rate limit</span><span>Mahasiswa-only</span></div></div>
   <Card className="auth-card">
     <div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>Masuk</button><button className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>Daftar</button></div>
     <div className="auth-card-head"><h2>{mode==='login'?'Selamat datang kembali':`Buat akun ${appSettings.app_name}`}</h2><p>{mode==='login'?'Gunakan email dan password akun kamu.':'Daftar dengan email aktif yang bisa kamu verifikasi.'}</p></div>
     <form onSubmit={submit} className="stack-form">
       {mode==='register'&&<Field label="Nama lengkap"><input name="fullName" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required placeholder="Nama lengkap" maxLength={150}/></Field>}
       <Field label="Email akun"><input name="email" autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nama@email.com"/></Field>
       <Field label="Password"><input name="password" autoComplete={mode==='login'?'current-password':'new-password'} type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Masukkan password"/></Field>
       {mode==='register'&&<div className="password-hint" aria-label="Syarat password">
         <small>Panduan kekuatan password (kebijakan final ditentukan Supabase):</small>
         <div className="password-rules">
           <span className={registerPasswordRules.length8?'valid':''}>{registerPasswordRules.length8?'✓':'○'} Minimal 8 karakter sebagai baseline</span>
           <span className={registerPasswordRules.lower?'valid':''}>{registerPasswordRules.lower?'✓':'○'} Huruf kecil</span>
           <span className={registerPasswordRules.upper?'valid':''}>{registerPasswordRules.upper?'✓':'○'} Huruf besar</span>
           <span className={registerPasswordRules.number?'valid':''}>{registerPasswordRules.number?'✓':'○'} Angka</span>
           <span className={registerPasswordRules.symbol?'valid':''}>{registerPasswordRules.symbol?'✓':'○'} Simbol</span>
         </div>
       </div>}
       {mode==='login'&&<button type="button" className="inline-link" onClick={()=>void reset()}>Lupa password?</button>}
       <TurnstileCaptcha onToken={handleCaptcha} resetKey={captchaReset} action={mode==='login'?'login':'signup'}/>
       {lockedUntil > 0 && <div className="alert alert-warning" role="alert">Login sementara dikunci. Coba lagi sekitar {remainingMinutes} menit.</div>}
       {error&&<div className="alert alert-danger" role="alert">{error}</div>}
       {info&&<div className="alert alert-info" role="status">{info}</div>}
       {verificationNeeded&&<div className="alert alert-warning" role="status"><strong>Email belum terverifikasi?</strong><p className="muted">Pastikan kamu memasukkan alamat email yang benar dan gunakan link verifikasi terbaru.</p><Button type="button" variant="soft" disabled={resendBusy||busy} onClick={()=>void resendVerification()}>{resendBusy?'Mengirim…':'Kirim ulang email verifikasi'}</Button></div>}
       <Button type="submit" disabled={busy||Boolean(lockedUntil)}>{busy?'Memproses…':mode==='login'?'Masuk':'Buat akun'}</Button>
       <p className="auth-security-note">Autentikasi dilindungi Supabase Auth, rate limit, dan CAPTCHA. Aplikasi tidak menyimpan password mentah.</p>
     </form>
   </Card>
 </div></>;
}
