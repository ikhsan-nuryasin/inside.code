import { useEffect, useRef, useState, type CSSProperties } from 'react';

type ToastTone = 'info'|'good'|'warn'|'danger';
type Toast = { id: number; title: string; message: string; tone: ToastTone; duration: number };
const EVENT = 'inside-code-toast';
const TITLES: Record<ToastTone,string> = { info:'Informasi', good:'Berhasil', warn:'Perlu perhatian', danger:'Terjadi masalah' };

export function showToast(message:string, tone:ToastTone='info', title?:string, duration?:number) {
  if(!message.trim()) return;
  window.dispatchEvent(new CustomEvent(EVENT,{detail:{message,title:title||TITLES[tone],tone,duration}}));
}

export function ToastHost(){
  const [items,setItems]=useState<Toast[]>([]);
  const timers=useRef<number[]>([]);
  useEffect(()=>{
    const on=(event:Event)=>{
      const detail=(event as CustomEvent<{message?:string;title?:string;tone?:ToastTone;duration?:number}>).detail;
      if(!detail?.message?.trim()) return;
      const tone=detail.tone||'info';
      const duration=detail.duration ?? ((tone==='danger'||tone==='warn')?7000:5200);
      const id=Date.now()+Math.random();
      setItems(v=>[...v,{id,title:detail.title||TITLES[tone],message:detail.message!.trim(),tone,duration}].slice(-2));
      const timer=window.setTimeout(()=>setItems(v=>v.filter(x=>x.id!==id)),duration);
      timers.current.push(timer);
    };
    window.addEventListener(EVENT,on);
    return()=>{window.removeEventListener(EVENT,on);timers.current.forEach(window.clearTimeout);timers.current=[];};
  },[]);
  if(!items.length) return null;
  return <div className="toast-stack" aria-live="assertive">
    {items.map(t=><section key={t.id} className={`app-toast toast-${t.tone}`} role={t.tone==='danger'?'alert':'status'} style={{'--toast-duration':`${t.duration}ms`} as CSSProperties}>
      <div className="toast-mark" aria-hidden="true">{t.tone==='good'?'✓':t.tone==='warn'?'!':t.tone==='danger'?'×':'i'}</div>
      <div className="toast-copy"><strong>{t.title}</strong><p>{t.message}</p></div>
      <button className="toast-close" type="button" aria-label="Tutup notifikasi" onClick={()=>setItems(v=>v.filter(x=>x.id!==t.id))}>×</button>
      <span className="toast-progress" aria-hidden="true" />
    </section>)}
  </div>;
}
