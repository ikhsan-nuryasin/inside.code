import { useEffect, useState } from 'react';
import { Badge, Button, Card, Empty, Field } from '../components/ui';
import { globalSearch } from '../lib/repository';
import type { SearchResult } from '../types/models';
import { nav } from '../lib/router';

const labels:Record<SearchResult['type'],string>={class:'Kelas',task:'Tugas',material:'Materi',announcement:'Pengumuman',forum:'Forum',note:'Catatan'};
export function SearchPage(){
  const [q,setQ]=useState(''); const [results,setResults]=useState<SearchResult[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{const id=window.setTimeout(()=>{if(q.trim().length<2){setResults([]);return;}setLoading(true);void globalSearch(q).then(setResults).catch(e=>setError(e instanceof Error?e.message:'Pencarian gagal.')).finally(()=>setLoading(false));},220);return()=>window.clearTimeout(id)},[q]);
  return <div className="stack-page"><div className="page-title"><div><span className="eyebrow">Global search</span><h2>Cari apa saja</h2><p>Telusuri kelas, tugas, materi, pengumuman, forum, dan catatan yang memang dapat kamu akses.</p></div></div><Card><Field label="Kata kunci"><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Contoh: database, CRUD, rapat…"/></Field></Card>{error&&<div className="alert alert-danger">{error}</div>}<Card>{loading?<div className="empty"><strong>Mencari…</strong></div>:results.length?results.map(r=><button key={`${r.type}:${r.id}`} className="search-row" onClick={()=>nav(r.href)}><div><div className="notification-title"><strong>{r.title}</strong><Badge tone="neutral">{labels[r.type]}</Badge></div><p>{r.excerpt||'Tidak ada cuplikan.'}</p><small>{r.className||'Lintas modul'}</small></div><span className="btn btn-ghost search-row-action" aria-hidden="true">Buka</span></button>):<Empty title={q.length>=2?'Tidak ada hasil':'Mulai mengetik'} body={q.length<2?'Gunakan minimal 2 karakter untuk memulai pencarian.':'Coba kata kunci yang lebih spesifik.'}/>}</Card></div>;
}
