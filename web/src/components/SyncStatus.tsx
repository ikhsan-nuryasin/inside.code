import { useEffect, useState } from 'react';
import { queueAll } from '../lib/offline';
import { syncNow } from '../lib/repository';

export function SyncStatus(){
 const [online,setOnline]=useState(navigator.onLine);
 const [pending,setPending]=useState(0);
 const [attention,setAttention]=useState(0);
 const [syncing,setSyncing]=useState(false);
 const refresh=async()=>{const items=await queueAll();setPending(items.length);setAttention(items.filter(x=>x.status==='failed'||x.status==='conflict').length);};
 useEffect(()=>{const on=()=>{setOnline(navigator.onLine);if(navigator.onLine){void syncNow().finally(()=>void refresh())}else{void refresh()}};window.addEventListener('online',on);window.addEventListener('offline',on);void (navigator.onLine ? syncNow().finally(()=>void refresh()) : refresh());return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',on)}},[]);
 const run=async()=>{if(!online)return;setSyncing(true);try{await syncNow();await refresh()}finally{setSyncing(false)}};
 const label=syncing?'Syncing…':!online?'Offline':attention?`⚠ ${attention} perlu perhatian`:pending?`${pending} antrean`:'Tersinkron';
 return <button className={`sync-pill ${online?'online':'offline'} ${attention?'has-attention':''}`} onClick={run} title={pending?'Klik untuk sinkronisasi':''}><i/>{label}</button>;
}
