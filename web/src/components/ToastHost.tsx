import { useEffect, useState } from 'react';

type Toast = { id: number; message: string; tone?: 'info'|'good'|'warn'|'danger' };
const EVENT = 'student-hub-toast';
export function showToast(message:string, tone:Toast['tone']='info') {
  window.dispatchEvent(new CustomEvent(EVENT,{detail:{message,tone}}));
}
export function ToastHost(){
  const [items,setItems]=useState<Toast[]>([]);
  useEffect(()=>{
    const on=(event:Event)=>{
      const detail=(event as CustomEvent<{message?:string;tone?:Toast['tone']}>).detail;
      if(!detail?.message)return;
      const id=Date.now()+Math.random();
      setItems(v=>[...v,{id,message:detail.message!,tone:detail.tone}].slice(-3));
      window.setTimeout(()=>setItems(v=>v.filter(x=>x.id!==id)),3600);
    };
    window.addEventListener(EVENT,on); return()=>window.removeEventListener(EVENT,on);
  },[]);
  if(!items.length)return null;
  return <div className="toast-stack" aria-live="polite" aria-atomic="true">{items.map(t=><div className={`app-toast toast-${t.tone||'info'}`} key={t.id}><span className="toast-mark">{t.tone==='good'?'✓':t.tone==='warn'?'!':t.tone==='danger'?'×':'i'}</span><span>{t.message}</span><button aria-label="Tutup" onClick={()=>setItems(v=>v.filter(x=>x.id!==t.id))}>×</button></div>)}</div>;
}
