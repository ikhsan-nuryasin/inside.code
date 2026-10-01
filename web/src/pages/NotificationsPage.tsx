import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty } from '../components/ui';
import { listNotifications, markNotificationRead, subscribeRealtime } from '../lib/repository';
import type { Notification } from '../types/models';
import { showToast } from '../components/ToastHost';
import { nav } from '../lib/router';
import { notificationTargetHref } from '../lib/notification-target';

function dayBucket(iso:string){
 const d=new Date(iso), now=new Date();
 const key=(x:Date)=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
 const diff=(key(now)-key(d))/86400000;
 if(diff===0)return 'Hari ini';
 if(diff===1)return 'Kemarin';
 return d.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'short',year:'numeric'});
}
function icon(type:string){return ({assignment:'✓',schedule:'□',forum:'◌',material:'▤',announcement:'!',cash:'Rp',group:'♙',poll:'◉',documentation:'▧',system:'•'} as Record<string,string>)[type]||'•'}

export function NotificationsPage(){
 const [items,setItems]=useState<Notification[]>([]);const [error,setError]=useState('');
 const unread=useMemo(()=>items.filter(n=>!n.is_read).length,[items]);
 const groups=useMemo(()=>{const map=new Map<string,Notification[]>();[...items].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).forEach(n=>{const k=dayBucket(n.created_at);if(!map.has(k))map.set(k,[]);map.get(k)!.push(n)});return [...map.entries()]},[items]);
 const load=()=>listNotifications().then(setItems).catch(e=>setError(e instanceof Error?e.message:'Gagal memuat notifikasi.'));
 useEffect(()=>{void load();const unsub=subscribeRealtime(()=>void load());return unsub},[]);
 const readAll=async()=>{const unreadIds=items.filter(n=>!n.is_read).map(n=>n.id);for(const id of unreadIds){try{await markNotificationRead(id)}catch{/* keep retryable item */}};setItems(prev=>prev.map(n=>({...n,is_read:true})));showToast('Semua notifikasi ditandai dibaca.','good')};
 const read=async(id:string)=>{try{await markNotificationRead(id);const selected=items.find(n=>n.id===id);setItems(prev=>prev.map(n=>n.id===id?{...n,is_read:true}:n));showToast('Notifikasi ditandai dibaca.','good');if(selected){const href=notificationTargetHref(selected);if(href!=='#/notifications')nav(href)}}catch(e){setError(e instanceof Error?e.message:'Gagal memperbarui notifikasi.')}};
 return <div className="stack-page">{error&&<div className="alert alert-danger" role="alert">{error}</div>}
  <div className="page-title"><div><span className="eyebrow">Updates</span><h2>Notifikasi <Badge tone={unread?'info':'neutral'}>{unread?`${unread} baru`:'Semua dibaca'}</Badge></h2><p>Aktivitas baru muncul sebagai popup. Riwayat lengkap ada di halaman ini.</p></div></div>
  <div className="notification-filter-row"><span className="notification-summary">🔔 {unread} belum dibaca</span><div className="button-row"><span className="notification-summary muted">Popup aktif sesuai preferensi</span>{unread>0&&<Button variant="soft" onClick={()=>void readAll()}>Tandai semua dibaca</Button>}</div></div>
  {groups.length?groups.map(([day,rows])=><div className="grouped-day" key={day}><div className="grouped-day-title">{day}</div><Card>{rows.map(n=><button key={n.id} className={`notification-row ${n.is_read?'read':'unread'}`} onClick={()=>void read(n.id)}><div className={`notification-icon type-${n.notification_type}`}>{icon(n.notification_type)}</div><div><div className="notification-title"><strong>{n.title}</strong><Badge tone={n.is_read?'neutral':'info'}>{n.is_read?'Dibaca':'Baru'}</Badge></div><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('id-ID')}</small></div></button>)}</Card></div>):<Card><Empty title="Belum ada notifikasi" body="Saat aktivitas kelas terjadi, notifikasinya akan muncul sebagai popup dan tercatat di sini."/></Card>}
 </div>;
}
