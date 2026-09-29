import { useState, type FormEvent } from 'react';
import { Button, Card, Field } from '../components/ui';
import { DEMO_MODE, requireSupabase } from '../lib/supabase';

export function UpdatePasswordPage({onDone}:{onDone:()=>void}) {
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(e:FormEvent)=>{
    e.preventDefault(); setError('');
    if(password.length<8) return setError('Password minimal 8 karakter.');
    if(password!==confirm) return setError('Konfirmasi password tidak sama.');
    if(DEMO_MODE) return setError('Demo mode tidak membutuhkan reset password.');
    setBusy(true);
    try {
      const {error}=await requireSupabase().auth.updateUser({password});
      if(error) throw error;
      onDone();
    } catch(err) { setError(err instanceof Error ? err.message : 'Gagal memperbarui password.'); }
    finally { setBusy(false); }
  };
  return <div className="auth-layout"><div className="auth-hero"><div className="hero-mark"><img src="/icon.svg" alt="Student Hub" /></div><span className="eyebrow">Student Hub</span><h1>Buat password baru.</h1><p>Gunakan password yang kuat dan jangan gunakan ulang password penting dari layanan lain.</p></div><Card className="auth-card"><form onSubmit={submit} className="stack-form"><Field label="Password baru"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/></Field><Field label="Konfirmasi password"><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} required/></Field>{error&&<div className="alert alert-danger">{error}</div>}<Button type="submit" disabled={busy}>{busy?'Menyimpan…':'Simpan password'}</Button></form></Card></div>;
}
