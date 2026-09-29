import { useEffect, useState, type ReactNode } from 'react';
import { nav, useRoute } from '../lib/router';
import { DEMO_MODE, supabase } from '../lib/supabase';
import { SyncStatus } from './SyncStatus';
import { clearLocalData, subscribeSyncEvents } from '../lib/offline';
import { listMyClassPositions } from '../lib/repository';
import type { ClassPosition } from '../types/models';
import { POSITION_LABEL } from '../lib/permissions';
import { ToastHost } from './ToastHost';
import { DialogHost } from './DialogHost';

const baseNav=[
  ['dashboard','Dashboard','home'],['classes','Kelas','grid'],['tasks','Tugas','check'],['calendar','Jadwal','calendar'],['notes','Catatan','note'],['documentation','Dokumentasi','image'],['cash','Kas','wallet'],['notifications','Notifikasi','bell'],['positions','Jabatan','users'],['randomizer','Randomizer','spark'],['search','Cari','search'],['help','Bantuan','help'],['quick-messages','Pesan Cepat','message'],['security','Keamanan','shield'],['settings','Pengaturan','settings']
] as const;

type IconName = typeof baseNav[number][2] | 'more';
function NavGlyph({name}:{name:string}){
  const common={width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,ariaHidden:true};
  switch(name as IconName){
    case'home':return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/></svg>;
    case'grid':return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>;
    case'check':return <svg {...common}><path d="M5 12.5 9 16l10-10"/><path d="M4 6h5"/></svg>;
    case'calendar':return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M7 14h3M14 14h3M7 18h3"/></svg>;
    case'note':return <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>;
    case'image':return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>;
    case'wallet':return <svg {...common}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 8h15M17 13h4"/><circle cx="17" cy="13" r=".5"/></svg>;
    case'bell':return <svg {...common}><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21h4"/></svg>;
    case'users':return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15 19a4 4 0 0 1 5-3.5"/></svg>;
    case'spark':return <svg {...common}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></svg>;
    case'search':return <svg {...common}><circle cx="10.5" cy="10.5" r="6"/><path d="m16 16 4.5 4.5"/></svg>;
    case'help':return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.8c-.95.95-1.8 1.38-1.8 3.2"/><path d="M12 17h.01"/></svg>;
    case'message':return <svg {...common}><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4.3A2.5 2.5 0 0 1 5 12.5z"/><path d="M8 8h8M8 11h5"/></svg>;
    case'shield':return <svg {...common}><path d="M12 3 20 6v5c0 5.1-3.4 8.6-8 10-4.6-1.4-8-4.9-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>;
    case'settings':return <svg {...common}><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/></svg>;
    case'more':return <svg {...common}><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>;
    default:return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
  }
}

export function AppShell({children}:{children:ReactNode}){
 const route=useRoute();
 const [positions,setPositions]=useState<ClassPosition[]>([]);
 const [update,setUpdate]=useState(false);
 const [moreOpen,setMoreOpen]=useState(false);
 const refreshIdentity=async()=>{try{const ps=await listMyClassPositions();setPositions(ps.map(p=>p.position));}catch{/* sidebar remains usable offline */}};
 useEffect(()=>{void refreshIdentity();return subscribeSyncEvents(()=>void refreshIdentity())},[]);
 useEffect(()=>{const on=()=>setUpdate(true);window.addEventListener('student-hub-sw-update',on);return()=>window.removeEventListener('student-hub-sw-update',on)},[]);
 const active=route.name==='class'?'classes':route.name;
 const visibleNav=baseNav.filter(([key])=>key!=='positions'||positions.some(p=>p==='ketua'||p==='wakil_ketua'));
 const logout=async()=>{if(!DEMO_MODE&&supabase)await supabase.auth.signOut();await clearLocalData();nav('/dashboard');location.reload()};
 return <div className="shell">
  <aside className="sidebar">
   <button className="brand" onClick={()=>nav('/dashboard')} aria-label="Student Hub"><span className="brand-icon" aria-hidden="true"><img src="/icon.svg" alt="" /></span><span><strong>Student Hub</strong><small>Ruang kelas mahasiswa</small></span></button>
   <nav className="side-nav" aria-label="Navigasi utama">{visibleNav.map(([key,label,icon])=><button key={key} aria-current={active===key?'page':undefined} className={active===key?'active':''} onClick={()=>nav(`/${key}`)}><b aria-hidden="true"><NavGlyph name={icon}/></b>{label}</button>)}</nav>
   <div className="side-bottom"><div className="sidebar-role"><span>Jabatan</span><strong>{positions.length?positions.map(p=>POSITION_LABEL[p]).join(' · '):'Anggota'}</strong></div><button onClick={()=>void logout()}>↪ Keluar</button></div>
  </aside>
  <main className="main-content">
   <section className="page-content">{children}</section>
  </main>
  <nav className="mobile-nav" aria-label="Navigasi mobile">
   {visibleNav.filter(([key])=>['dashboard','classes','tasks','calendar'].includes(key)).map(([key,label,icon])=><button key={key} aria-current={active===key?'page':undefined} className={active===key?'active':''} onClick={()=>nav(`/${key}`)}><b aria-hidden="true"><NavGlyph name={icon}/></b><span>{key==='dashboard'?'Home':label}</span></button>)}
   <button className={moreOpen?'active':''} aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><b aria-hidden="true"><NavGlyph name="more"/></b><span>Lainnya</span></button>
  </nav>
  {moreOpen&&<div className="mobile-more-backdrop" onClick={()=>setMoreOpen(false)}><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Menu lainnya" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span className="eyebrow">Menu</span><h3>Akses lainnya</h3></div><button className="sheet-close" onClick={()=>setMoreOpen(false)} aria-label="Tutup menu">×</button></div><div className="more-grid">{visibleNav.filter(([key])=>!['dashboard','classes','tasks','calendar'].includes(key)).map(([key,label,icon])=><button key={key} onClick={()=>{setMoreOpen(false);nav(`/${key}`)}}><span className="more-icon"><NavGlyph name={icon}/></span><span>{label}</span></button>)}</div></section></div>}
  <ToastHost/>
  <DialogHost/>
  {update&&<div className="update-bar" role="status"><strong>Versi baru Student Hub tersedia.</strong><button onClick={()=>location.reload()}>Muat ulang</button><button className="ghost-link" onClick={()=>setUpdate(false)}>Nanti</button></div>}
 </div>;
}
