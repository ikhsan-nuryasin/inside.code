import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty } from '../components/ui';
import { getClassPosition, listAnnouncements, listAssignments, listClasses, listSchedules, getProfile } from '../lib/repository';
import type { Announcement, Assignment, ClassPositionRecord, ClassRecord, Schedule } from '../types/models';
import { getActiveClassId, nav, setActiveClassId } from '../lib/router';
import { POSITION_LABEL } from '../lib/permissions';
import { DEMO_MODE, supabase } from '../lib/supabase';
import { demoProfile } from '../lib/demo';


function HomeGlyph({name}:{name:'class'|'task'|'calendar'|'cash'|'notification'|'arrow'}){
 const common={width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,ariaHidden:true};
 switch(name){
  case'class': return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
  case'task': return <svg {...common}><path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m8 12 2.2 2.2L16 8.7"/></svg>;
  case'calendar': return <svg {...common}><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;
  case'cash': return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10h10M8 15h.01M16 15h.01"/></svg>;
  case'notification': return <svg {...common}><path d="M6 10a6 6 0 1 1 12 0c0 5 2 6 3 8H3c1-2 3-3 3-8"/><path d="M10 21h4"/></svg>;
  default: return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
 }
}

export function DashboardPage(){
 const [classes,setClasses]=useState<ClassRecord[]>([]);
 const [tasks,setTasks]=useState<(Assignment&{className:string})[]>([]);
 const [schedule,setSchedule]=useState<(Schedule&{className:string;delivery_mode:'offline'|'online'})[]>([]);
 const [ann,setAnn]=useState<(Announcement&{className:string})[]>([]);
 const [displayName,setDisplayName]=useState(DEMO_MODE?demoProfile.full_name:'Mahasiswa');
 const [positions,setPositions]=useState<(ClassPositionRecord&{className:string})[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{(async()=>{try{
   try {
     if (DEMO_MODE) setDisplayName(demoProfile.full_name);
     else if (supabase) { const {data}=await supabase.auth.getSession(); setDisplayName(data.session?.user.user_metadata?.full_name || data.session?.user.email?.split('@')[0] || 'Mahasiswa'); }
     else { const p=await getProfile(); setDisplayName(p?.full_name || 'Mahasiswa'); }
   } catch {}

   const cs=await listClasses();
   const stored=getActiveClassId();
   const preferred=cs.find(c=>c.id===stored)?.id||cs[0]?.id||'';
   if(preferred)setActiveClassId(preferred);
   setClasses(cs);
   const rows=await Promise.all(cs.map(async c=>{
     const [t,s,a,p]=await Promise.all([listAssignments(c.id),listSchedules(c.id),listAnnouncements(c.id),getClassPosition(c.id)]);
     return {classRecord:c,t,s,a,p};
   }));
   setTasks(rows.flatMap(r=>r.t.map(x=>({...x,className:r.classRecord.name}))));
   setSchedule(rows.flatMap(r=>r.s.map(x=>({...x,className:r.classRecord.name,delivery_mode:r.classRecord.delivery_mode}))));
   setAnn(rows.flatMap(r=>r.a.map(x=>({...x,className:r.classRecord.name}))));
   setPositions(rows.flatMap(r=>r.p?[{...r.p,className:r.classRecord.name}]:[]));
 }catch(e){setError(e instanceof Error?e.message:'Gagal memuat dashboard.')}})()},[]);
 const nowDate=new Date();
 const currentDay=nowDate.getDay()===0?7:nowDate.getDay();
 const nowMinutes=nowDate.getHours()*60+nowDate.getMinutes();
 const minutesFromCurrent=(row:(Schedule&{className:string;delivery_mode:'offline'|'online'}))=>{const [hh,mm]=row.starts_at.slice(0,5).split(':').map(Number);const startMinutes=hh*60+mm;let delta=row.day_of_week-currentDay;if(delta<0||(delta===0&&startMinutes<nowMinutes))delta+=7;return delta*1440+startMinutes-nowMinutes;};
 const upcoming=[...schedule].sort((a,b)=>minutesFromCurrent(a)-minutesFromCurrent(b));
 const nearest=upcoming[0];
 const latestAnnouncements=[...ann].sort((a,b)=>new Date(b.published_at).getTime()-new Date(a.published_at).getTime());
 const activeTasks=tasks.filter(t=>t.progress_status!=='completed').sort((a,b)=>(a.deadline??'9999').localeCompare(b.deadline??'9999'));
 const reminderTasks=activeTasks.filter(t=>t.deadline&&new Date(t.deadline).getTime()-Date.now()<=24*60*60*1000).slice(0,3);
 const derivedActivities=[...tasks.map(t=>({id:`task-${t.id}`,title:`Tugas: ${t.title}`,time:t.deadline??'',kind:'Tugas'})),...ann.map(a=>({id:`ann-${a.id}`,title:`Pengumuman: ${a.title}`,time:a.published_at,kind:'Pengumuman'}))].sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,5);
 const responsibilities=useMemo(()=>{
   const map=new Map<string,string[]>();
   for(const p of positions){
     const label=POSITION_LABEL[p.position];
     if(!map.has(label))map.set(label,[]);
     const list=map.get(label)!;
     const items=p.position==='bendahara'?['Kelola kas & iuran','Verifikasi pembayaran','Laporan keuangan']:p.position==='sekretaris'?['Buat pengumuman','Kelola jadwal & materi','Kelola dokumentasi']:['Kelola kelas & tugas','Kelola kelompok','Kelola jabatan'];
     for(const item of items)if(!list.includes(item))list.push(item);
   }
   return [...map.entries()];
 },[positions]);
 const activeClass=classes[0];
 const taskPercent=(t:Assignment)=>t.progress_status==='completed'?100:t.progress_status==='in_progress'?65:30;
 return <div className="stack-page">
   {error&&<div className="alert alert-danger">{error}</div>}
   <div className="dashboard-mobile-reference" aria-label="Dashboard mobile Inside Code">
     <div className="mobile-home-hero">
       <div className="mobile-welcome-row">
         <div><span className="eyebrow">{activeClass?.study_program||'Sistem Informasi'} · Semester {activeClass?.semester??3}</span><h2>Selamat siang,<br/><strong>{displayName} 👋</strong></h2></div>
         <button className="mobile-round-icon" onClick={()=>nav('/notifications')} aria-label="Notifikasi"><HomeGlyph name="notification"/><i/></button>
       </div>
     </div>
     <button className="mobile-active-class" onClick={()=>activeClass&&nav(`/classes/${activeClass.id}`)} disabled={!activeClass}>
       <span className="class-mini-icon"><HomeGlyph name="class"/></span>
       <span className="active-class-copy"><small>Kelas Aktif</small><strong>{activeClass?.name||'Belum ada kelas'}</strong><span>{activeClass?.study_program||'Sistem Informasi'} · Semester {activeClass?.semester??3}</span></span>
       <b className="chevron"><HomeGlyph name="arrow"/></b>
     </button>
     <div className="mobile-section-title"><span>Tugas Terdekat</span><button onClick={()=>nav('/tasks')}>Semua</button></div>
     <div className="mobile-stack-list">
       {activeTasks.length?activeTasks.slice(0,2).map((t,i)=><button key={t.id} className="mobile-task-card" onClick={()=>nav('/tasks')}>
         <span className={`mobile-task-icon ${i===0?'blue':'purple'}`}><HomeGlyph name="task"/></span>
         <span className="mobile-card-main"><span className="mobile-card-title"><strong>{t.title}</strong>{(t.priority==='urgent'||t.priority==='high')&&<em>Prioritas Tinggi</em>}</span><small>{t.subject_name||t.className||'Tugas kelas'} · {t.deadline?new Date(t.deadline).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}):'Tanpa deadline'}</small><div className="progress-line"><i style={{width:`${taskPercent(t)}%`}}/></div><span className="progress-label">{taskPercent(t)}% selesai</span></span>
         <b className="chevron"><HomeGlyph name="arrow"/></b>
       </button>):<Card><Empty title="Semua tugas selesai" body="Tidak ada tugas aktif."/></Card>}
     </div>
     <div className="mobile-section-title"><span>Jadwal Berikutnya</span><button onClick={()=>nav('/calendar')}>Semua</button></div>
     {nearest?<button className="mobile-schedule-card" onClick={()=>nav('/calendar')}><span className="mobile-schedule-icon"><HomeGlyph name="calendar"/></span><span><strong>{nearest.subject?.name||'Mata kuliah'}</strong><small>{nearest.starts_at.slice(0,5)} · {nearest.room||'Ruang 302'}</small><small>{nearest.className}</small></span><b className="chevron"><HomeGlyph name="arrow"/></b></button>:<Card><Empty title="Belum ada jadwal"/></Card>}
     <div className="mobile-section-title"><span>Quick Access</span><span/></div>
     <div className="quick-access-grid">{[['class','Kelas','/classes'],['task','Tugas','/tasks'],['calendar','Jadwal','/calendar'],['cash','Kas','/cash']].map(([icon,label,path])=><button key={label} onClick={()=>nav(path)}><span><HomeGlyph name={icon as 'class'|'task'|'calendar'|'cash'} /></span><small>{label}</small></button>)}</div>
     {reminderTasks.length>0&&<Card className="reminder-card"><div className="section-head"><div><span className="eyebrow">Pengingat</span><h3>Deadline dalam 24 jam</h3></div><Badge tone="warn">{reminderTasks.length}</Badge></div>{reminderTasks.map(t=><div className="reminder-row" key={t.id}><div><strong>{t.title}</strong><small>{t.deadline?new Date(t.deadline).toLocaleString('id-ID'):'Tanpa deadline'}</small></div><button onClick={()=>{localStorage.setItem(`inside-code-reminder:${t.id}`,String(Date.now()));nav('/tasks')}}>Lihat</button></div>)}</Card>}
     <div className="mobile-secondary-preview">
       <Card><div className="section-head"><h3>Pengumuman Terbaru</h3><button className="link-btn" onClick={()=>activeClass&&nav(`/classes/${activeClass.id}`)}>Semua</button></div>{latestAnnouncements.slice(0,2).map(a=><div className="announcement" key={a.id}><div className="announcement-dot"/><div><strong>{a.title}</strong><small>{a.className} · {new Date(a.published_at).toLocaleDateString('id-ID')}</small></div></div>)}{!latestAnnouncements.length&&<Empty title="Belum ada pengumuman"/>}</Card>
       <Card><div className="section-head"><h3>Aktivitas kelas</h3></div>{responsibilities.length?responsibilities.slice(0,2).map(([role,items])=><div className="role-responsibility" key={role}><strong>{role}</strong><p className="muted">{items[0]}</p></div>):<p className="muted">Aktivitas kelasmu akan tampil di sini.</p>}</Card><Card><div className="section-head"><div><span className="eyebrow">Timeline</span><h3>Aktivitas terbaru</h3></div></div>{derivedActivities.map(a=><div className="activity-row" key={a.id}><span className="activity-dot"/><div><strong>{a.title}</strong><small>{a.kind} · {a.time?new Date(a.time).toLocaleString('id-ID'):''}</small></div></div>)}</Card>
     </div>
   </div>
   <div className="dashboard-desktop-reference">
     <div className="hero-banner"><div><span className="eyebrow">Student workspace</span><h2>Semua aktivitas kelas, satu tempat.</h2><p>Jadwal, tugas, materi, komunitas, dan administrasi kelas tetap terhubung meskipun koneksi tidak stabil.</p></div><Button variant="soft" onClick={()=>nav('/classes')}>Lihat kelas →</Button></div>
     <div className="metric-grid"><Card><span className="metric-label">Kelas aktif</span><strong>{classes.length}</strong><small>Tersimpan di akunmu</small></Card><Card><span className="metric-label">Tugas belum selesai</span><strong>{activeTasks.length}</strong><small>Semua kelas</small></Card><Card><span className="metric-label">Jadwal</span><strong>{schedule.length}</strong><small>Semua kelas</small></Card><Card><span className="metric-label">Pengumuman</span><strong>{ann.length}</strong><small>Semua kelas</small></Card></div>
     {reminderTasks.length>0&&<Card className="reminder-card"><div className="section-head"><div><span className="eyebrow">Pengingat deadline</span><h3>{reminderTasks.length} tugas perlu perhatian</h3></div><Badge tone="warn">24 jam</Badge></div>{reminderTasks.map(t=><div className="reminder-row" key={t.id}><div><strong>{t.title}</strong><small>{t.className} · {t.deadline?new Date(t.deadline).toLocaleString('id-ID'):'Tanpa deadline'}</small></div><button onClick={()=>nav('/tasks')}>Buka tugas</button></div>)}</Card>}
     <div className="grid-2"><Card><div className="section-head"><div><span className="eyebrow">Next</span><h3>Jadwal berikutnya</h3></div><button className="link-btn" onClick={()=>nav('/calendar')}>Semua</button></div>{nearest?<div className="focus-row"><div className="date-badge">{['','Sen','Sel','Rab','Kam','Jum','Sab','Min'][nearest.day_of_week]}</div><div><strong>{nearest.subject?.name??'Mata kuliah'}</strong><p>{nearest.starts_at.slice(0,5)}–{nearest.ends_at.slice(0,5)} · {nearest.delivery_mode==='online'?'🌐 Online':(nearest.room||'Tanpa ruang')}</p><small>{nearest.className}</small></div></div>:<Empty title="Belum ada jadwal" body="Belum ada jadwal tersimpan di kelasmu."/>}</Card><Card><div className="section-head"><div><span className="eyebrow">Priority</span><h3>Tugas terdekat</h3></div><button className="link-btn" onClick={()=>nav('/tasks')}>Semua</button></div>{activeTasks.length?activeTasks.slice(0,5).map(t=><button key={t.id} className="list-row clickable" onClick={()=>nav('/tasks')}><div><strong>{t.title}</strong><small>{t.className} · {t.deadline?new Date(t.deadline).toLocaleDateString('id-ID'):'Tanpa deadline'}</small></div><Badge tone={t.priority==='urgent'||t.priority==='high'?'warn':'neutral'}>{t.priority}</Badge></button>):<Empty title="Semua tugas selesai" body="Tidak ada tugas aktif."/>}</Card></div>
     <div className="grid-2"><Card><div className="section-head"><div><span className="eyebrow">Latest</span><h3>Pengumuman</h3></div></div>{latestAnnouncements.length?latestAnnouncements.slice(0,5).map(a=><div className="announcement" key={a.id}><div className="announcement-dot"/><div><strong>{a.title}</strong><p>{a.content}</p><small>{a.className} · {new Date(a.published_at).toLocaleString('id-ID')}</small></div></div>):<Empty title="Belum ada pengumuman"/>}</Card><Card><div className="section-head"><div><span className="eyebrow">Your role</span><h3>Tanggung jawab jabatan</h3></div></div>{responsibilities.length?responsibilities.map(([role,items])=><div className="role-responsibility" key={role}><strong>{role}</strong><div>{items.map(item=><span key={item} className="role-chip">{item}</span>)}</div></div>):<div className="role-responsibility"><strong>Anggota</strong><p className="muted">Fokus pada tugas, jadwal, materi, forum, kelompok, dokumentasi, dan aktivitas pribadi.</p></div>}</Card></div>
   </div>
 </div>;
}
