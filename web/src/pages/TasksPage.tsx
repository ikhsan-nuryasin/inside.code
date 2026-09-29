import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Field } from '../components/ui';
import { currentUserId, listAllAssignments, listClasses, listChecklistItems, listChecklistProgress, setAssignmentProgress, setChecklistProgress } from '../lib/repository';
import type { Assignment, ChecklistItem, ChecklistProgress } from '../types/models';
import { getActiveClassId, nav, openClassModule, setActiveClassId } from '../lib/router';
import { showToast } from '../components/ToastHost';

export function TasksPage(){
 const [items,setItems]=useState<Assignment[]>([]);
 const [error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 const [checks,setChecks]=useState<Record<string,ChecklistItem[]>>({});
 const [progress,setProgress]=useState<Record<string,ChecklistProgress[]>>({});
 const [filter,setFilter]=useState<'all'|'open'|'completed'>('open');
 const [query,setQuery]=useState('');
 const [classes,setClasses]=useState<{id:string;name:string}[]>([]);
 const [classFilter,setClassFilter]=useState(getActiveClassId());
 const [priority,setPriority]=useState<'all'|'urgent'|'high'|'normal'|'low'>('all');
 const load=async()=>{try{const [rows,cs]=await Promise.all([listAllAssignments(),listClasses()]);setItems(rows);setClasses(cs.map(c=>({id:c.id,name:c.name})));const stored=getActiveClassId();const preferred=cs.find(c=>c.id===stored)?.id||cs[0]?.id||'';if(preferred){setClassFilter(preferred);setActiveClassId(preferred)}}catch(e){setError(e instanceof Error?e.message:'Gagal memuat tugas.')}};
 useEffect(()=>{void load()},[]);
 const visible=useMemo(()=>items.filter(t=>{
   const q=query.trim().toLowerCase();
   const matches=!q||t.title.toLowerCase().includes(q)||(t.description||'').toLowerCase().includes(q)||(t.class_name||'').toLowerCase().includes(q)||(t.subject_name||'').toLowerCase().includes(q);
   const statusOk=filter==='all'||(filter==='completed'?t.progress_status==='completed':t.progress_status!=='completed');
   const priorityOk=priority==='all'||t.priority===priority;
   const classOk=!classFilter||t.class_id===classFilter;
   return matches&&statusOk&&priorityOk&&classOk;
 }).sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999')),[items,filter,query,priority,classFilter]);
 const dueSoon=useMemo(()=>items.filter(t=>t.progress_status!=='completed'&&t.deadline).filter(t=>new Date(t.deadline!).getTime()>Date.now()&&new Date(t.deadline!).getTime()-Date.now()<=24*60*60*1000).length,[items]);
 const update=async(id:string,status:NonNullable<Assignment['progress_status']>)=>{try{await setAssignmentProgress(id,status);setItems(v=>v.map(t=>t.id===id?{...t,progress_status:status}:t));showToast('Progress tugas disimpan.','good')}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan progress.')}};
 const open=async(id:string)=>{setExpanded(v=>v===id?null:id);if(expanded===id)return;try{const [ci,cp]=await Promise.all([listChecklistItems(id),listChecklistProgress(id)]);setChecks(v=>({...v,[id]:ci}));setProgress(v=>({...v,[id]:cp}))}catch(e){setError(e instanceof Error?e.message:'Gagal memuat checklist.')}};
 const toggle=async(item:ChecklistItem,assignmentId:string)=>{const uid=await currentUserId();if(!uid)return;const old=progress[assignmentId]?.find(p=>p.checklist_item_id===item.id);const done=!(old?.completed??false);try{await setChecklistProgress(item.id,done);setProgress(v=>({...v,[assignmentId]:[...(v[assignmentId]??[]).filter(x=>x.checklist_item_id!==item.id),{checklist_item_id:item.id,user_id:uid,completed:done,updated_at:new Date().toISOString()}]}));showToast(done?'Checklist selesai.':'Checklist dibatalkan.','good')}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan checklist.')}};
 const percent=(t:Assignment)=>t.progress_status==='completed'?100:t.progress_status==='in_progress'?65:30;
 return <div className="stack-page">
   <div className="page-title">
     <div><span className="eyebrow">Unified task inbox</span><h2>Tugas saya</h2><p>Semua tugas lintas kelas dalam satu inbox. Progress checklist tetap pribadi.</p></div>
     <div className="task-page-actions"><Button variant="soft" onClick={()=>nav('/calendar')}>Kalender</Button></div>
   </div>
   {dueSoon>0&&<div className="attention-banner"><span>⏰</span><div><strong>{dueSoon} tugas deadline dalam 24 jam</strong><small>Prioritaskan tugas yang paling dekat.</small></div><button onClick={()=>setPriority('all')}>Lihat</button></div>}
   {error&&<div className="alert alert-danger" role="alert">{error}</div>}
   <Card className="task-inbox-controls">
     <div className="task-context-row"><label className="field compact-field"><span>Kelas</span><select value={classFilter} onChange={e=>{setClassFilter(e.target.value);if(e.target.value)setActiveClassId(e.target.value)}}><option value="">Semua kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{classFilter&&<button className="context-open-link" onClick={()=>openClassModule(classFilter,`/classes/${classFilter}?tab=tasks`)}>Buka kelas →</button>}</div>
     <Field label="Cari tugas"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari judul, mata kuliah, kelas…"/></Field>
     <div className="reference-chip-row" role="tablist" aria-label="Status tugas">
       {([['open','Belum selesai'],['completed','Selesai'],['all','Semua']] as const).map(([k,label])=><button key={k} className={`reference-chip ${filter===k?'active':''}`} onClick={()=>setFilter(k)}>{label}</button>)}
     </div>
     <div className="reference-chip-row" aria-label="Filter prioritas">
       {([['all','Semua prioritas'],['urgent','Mendesak'],['high','Tinggi'],['normal','Normal'],['low','Rendah']] as const).map(([k,label])=><button key={k} className={`reference-chip ${priority===k?'active':''}`} onClick={()=>setPriority(k)}>{label}</button>)}
     </div>
   </Card>
   <Card className="task-list-card">
    <div className="section-head"><div><span className="eyebrow">Daftar tugas</span><h3>{visible.length} tugas</h3></div><Badge tone={filter==='completed'?'good':visible.length?'info':'neutral'}>{filter==='completed'?'Selesai':'Aktif'}</Badge></div>
    {visible.length?visible.map((t,i)=>{
      const checked=progress[t.id]?.filter(p=>p.completed).length??0; const total=checks[t.id]?.length??0;
      return <div key={t.id} className="task-block">
       <div className="task-item">
        <span className={`task-leading-icon task-icon-${i%4}`}>✓</span>
        <div className="task-info"><div className="task-title-line"><strong>{t.title}</strong>{(t.priority==='urgent'||t.priority==='high')&&<Badge tone="warn">Prioritas {t.priority==='urgent'?'Mendesak':'Tinggi'}</Badge>}</div><p>{t.description||'Tidak ada deskripsi.'}</p><small>{t.class_name||'Kelas'}{t.subject_name?` · ${t.subject_name}`:''}{t.deadline?` · ${new Date(t.deadline).toLocaleString('id-ID')}`:''}</small><div className="task-progress-mini"><i style={{width:`${percent(t)}%`}}/></div><span className="progress-label">{percent(t)}% selesai{total?` · ${checked}/${total} checklist`:''}</span></div>
        <div className="task-actions"><select className="status-select" value={t.progress_status||'not_started'} onChange={e=>void update(t.id,e.target.value as NonNullable<Assignment['progress_status']>)}><option value="not_started">Belum mulai</option><option value="in_progress">Dikerjakan</option><option value="completed">Selesai</option></select><Button variant="ghost" onClick={()=>void open(t.id)}>{expanded===t.id?'Tutup':'Detail'}</Button></div>
       </div>
       {expanded===t.id&&<div className="checklist-box">
         <div className="detail-grid">
          <div><strong className="checklist-heading">Checklist</strong>{checks[t.id]?.length?checks[t.id].map(item=>{const done=progress[t.id]?.some(p=>p.checklist_item_id===item.id&&p.completed)??false;return <button className={`check-row ${done?'done':''}`} key={item.id} onClick={()=>void toggle(item,t.id)}><span>{done?'✓':'○'}</span><span>{item.title}</span></button>}):<Empty title="Belum ada checklist" body="Checklist dikelola dari detail tugas kelas."/>}</div>
          <div className="task-detail-summary"><strong>Ringkasan</strong><div className="detail-metric"><span>Status</span><b>{t.progress_status==='completed'?'Selesai':t.progress_status==='in_progress'?'Dikerjakan':'Belum mulai'}</b></div><div className="detail-metric"><span>Prioritas</span><b>{t.priority}</b></div><div className="detail-metric"><span>Deadline</span><b>{t.deadline?new Date(t.deadline).toLocaleString('id-ID'):'Tidak ada'}</b></div></div>
         </div>
       </div>}
      </div>
    }):<Empty title={query?'Tidak ada hasil tugas':'Tidak ada tugas'} body={query?'Coba kata kunci lain.':filter==='completed'?'Belum ada tugas yang selesai.':'Inbox tugas sedang kosong.'}/>} 
   </Card>
   <Card className="task-group-link"><div className="section-head"><div><span className="eyebrow">Tugas kelompok</span><h3>Kelola dari workspace kelas</h3></div><Badge tone="info">Kelompok</Badge></div><p className="muted">Tugas kelompok, PIC, progress, dan pemilihan ketua tersedia di modul Kelompok pada detail kelas.</p><Button variant="soft" onClick={()=>classFilter?openClassModule(classFilter,`/classes/${classFilter}?tab=tasks`):nav('/classes')}>Buka kelas</Button></Card>
 </div>;
}
