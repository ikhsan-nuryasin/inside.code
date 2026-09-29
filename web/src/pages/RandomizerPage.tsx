import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty } from '../components/ui';
import {
  listClasses,
  listGroups,
  listGroupMembers,
  listClassMembers,
  setGroupLeader,
  saveRandomizerResult,
  listRandomizerHistory,
  createClassEvent,
} from '../lib/repository';
import type { ClassMember, ClassRecord, GroupMember, GroupRecord, RandomizerHistoryRecord } from '../types/models';
import { getActiveClassId, nav, openClassModule, setActiveClassId } from '../lib/router';
import { showToast } from '../components/ToastHost';
import { requestConfirm } from '../components/DialogHost';

type Mode = 'group_leader' | 'presentation_order' | 'member_random';
type LeaderMethod = 'wheel' | 'manual';
type RandomItem = { key: string; label: string; meta?: string; userId?: string; groupId?: string };

const COLORS = ['#2d8cff', '#55c78a', '#8a71ff', '#ff9b5c', '#ef6e87', '#3eb4d7', '#f1c75b', '#6e86ff'];

function wheelGeometry(count: number) {
  const safe = Math.max(1, count);
  return { safe, step: 360 / safe };
}
function polar(cx: number, cy: number, r: number, angle: number) {
  const a = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function sectorPath(cx: number, cy: number, r: number, start: number, end: number) {
  const p1 = polar(cx, cy, r, end), p2 = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p2.x} ${p2.y} Z`;
}

function Wheel({ items, spinKey, targetIndex }: { items: RandomItem[]; spinKey: number; targetIndex: number }) {
  const { step } = wheelGeometry(items.length);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    if (!spinKey || targetIndex < 0 || !items.length) return;
    const targetCenter = targetIndex * step + step / 2;
    const desired = 360 - targetCenter;
    setRotation(prev => {
      const current = ((prev % 360) + 360) % 360;
      const delta = (desired - current + 360) % 360;
      return prev + 360 * 6 + delta;
    });
  }, [spinKey, targetIndex, step, items.length]);

  if (!items.length) return <div className="selection-wheel empty-wheel"><span>Belum ada kandidat</span></div>;

  return <div className="wheel-stage" aria-label="Roda pemilihan acak">
    <div className="wheel-pointer" aria-hidden="true">▼</div>
    <div className="wheel-graphic" style={{ transform: `rotate(${rotation}deg)` }}>
      <svg viewBox="0 0 220 220" role="img" aria-label={`Roda berisi ${items.length} pilihan`}>
        {items.map((item, i) => {
          const start = i * step, end = (i + 1) * step, mid = (start + end) / 2;
          const tp = polar(110, 110, 68, mid);
          const compact = items.length > 10 ? 6 : items.length > 7 ? 7 : 9;
          return <g key={`${item.key}-${i}`}>
            <path d={sectorPath(110, 110, 102, start, end)} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="2" />
            {items.length <= 16 && <text x={tp.x} y={tp.y} fill="#fff" fontSize={compact} fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${mid} ${tp.x} ${tp.y})`}>{item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label}</text>}
          </g>;
        })}
        <circle cx="110" cy="110" r="34" fill="#fff" stroke="#dceaf7" strokeWidth="4" />
        <circle cx="110" cy="110" r="27" fill="#087cf9" />
        <text x="110" y="113" fill="#fff" fontSize="9" fontWeight="900" textAnchor="middle">PUTAR</text>
      </svg>
    </div>
  </div>;
}

function fairRandomIndex(length: number): number {
  if (length <= 1) return 0;
  const maxUint = 0x100000000;
  const limit = Math.floor(maxUint / length) * length;
  const buffer = new Uint32Array(1);
  do {
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buffer);
    else buffer[0] = Math.floor(Math.random() * maxUint);
  } while (buffer[0] >= limit);
  return buffer[0] % length;
}

function sameDayTimes(start: string, durationMinutes: number, index: number, gapMinutes: number) {
  const [h, m] = start.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) throw new Error('INVALID_START_TIME');
  const startMinutes = h * 60 + m + index * (durationMinutes + gapMinutes);
  const endMinutes = startMinutes + durationMinutes;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${pad(Math.floor(startMinutes / 60) % 24)}:${pad(startMinutes % 60)}`,
    end: `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`,
    endMinutes,
  };
}

export function RandomizerPage() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [activeClass, setActiveClass] = useState('');
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [mode, setMode] = useState<Mode>('presentation_order');
  const [leaderMethod, setLeaderMethod] = useState<LeaderMethod>('wheel');
  const [items, setItems] = useState<RandomItem[]>([]);
  const [result, setResult] = useState<RandomItem[]>([]);
  const [remaining, setRemaining] = useState<RandomItem[]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [targetIndex, setTargetIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<RandomizerHistoryRecord[]>([]);
  const [pendingLeader, setPendingLeader] = useState<RandomItem | null>(null);
  const [presentation, setPresentation] = useState({ date: '', start: '13:00', duration: '15', gap: '0', location: '', meetingUrl: '', saveToCalendar: true });

  useEffect(() => {
    void listClasses().then(cs => {
      setClasses(cs);
      const stored = getActiveClassId();
      const preferred = cs.find(c => c.id === stored)?.id || cs[0]?.id || '';
      if (preferred) { setActiveClass(preferred); setActiveClassId(preferred); }
    }).catch(e => setMessage(e instanceof Error ? e.message : 'Gagal memuat kelas.'));
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    setMessage('');
    void Promise.all([listGroups(activeClass), listClassMembers(activeClass), listRandomizerHistory(activeClass)])
      .then(([gs, ms, hs]) => {
        setGroups(gs); setMembers(ms); setHistory(hs);
        setSelectedGroup(current => gs.some(g => g.id === current) ? current : (gs[0]?.id || ''));
      })
      .catch(e => setMessage(e instanceof Error ? e.message : 'Gagal memuat data randomizer.'));
  }, [activeClass]);

  useEffect(() => {
    if (mode !== 'group_leader' || !selectedGroup) { setGroupMembers([]); return; }
    void listGroupMembers(selectedGroup).then(setGroupMembers).catch(e => setMessage(e instanceof Error ? e.message : 'Gagal memuat anggota kelompok.'));
  }, [mode, selectedGroup]);

  const buildItems = useMemo<RandomItem[]>(() => {
    if (mode === 'presentation_order') return groups.map(g => ({ key: g.id, groupId: g.id, label: g.name, meta: 'Kelompok' }));
    if (mode === 'member_random') return members.filter(m => m.status === 'active').map(m => ({ key: m.id, userId: m.user_id, label: m.full_name || m.nim || m.user_id, meta: m.nim || 'Anggota aktif' }));
    return groupMembers.map(m => ({ key: m.id, userId: m.user_id, label: m.full_name || m.nim || m.user_id, meta: m.nim || 'Anggota kelompok' }));
  }, [mode, groups, members, groupMembers]);

  useEffect(() => {
    setItems(buildItems);
    setRemaining(buildItems);
    setResult([]);
    setTargetIndex(-1);
    setPendingLeader(null);
    setMessage('');
  }, [buildItems]);

  const selectedGroupName = groups.find(g => g.id === selectedGroup)?.name;
  const subtitle = useMemo(() => mode === 'presentation_order'
    ? 'Putar satu kali untuk satu kelompok. Kelompok yang sudah terpilih otomatis keluar dari putaran berikutnya.'
    : mode === 'group_leader'
      ? leaderMethod === 'manual' ? 'Pilih satu anggota lalu konfirmasi untuk menetapkannya sebagai ketua.' : 'Hasil roda hanya memilih kandidat. Penetapan ketua dilakukan setelah kamu mengonfirmasi hasil.'
      : 'Pilih satu mahasiswa secara acak. Hasil berikutnya dapat memilih dari peserta yang masih tersisa.', [mode, leaderMethod]);

  const spin = () => {
    const pool = remaining;
    if (!pool.length || busy) return;
    setBusy(true); setMessage('');
    const winnerIndex = fairRandomIndex(pool.length);
    const winner = pool[winnerIndex];
    setTargetIndex(winnerIndex); setSpinKey(v => v + 1);
    window.setTimeout(() => {
      setResult(prev => mode === 'presentation_order' ? [...prev, winner] : [winner]);
      setRemaining(pool.filter((_, index) => index !== winnerIndex));
      if (mode === 'group_leader') setPendingLeader(winner);
      setBusy(false);
    }, 1400);
  };

  const setWheelLeader = async () => {
    if (!pendingLeader?.userId || !selectedGroup || busy) return;
    const ok = await requestConfirm(`Tetapkan ${pendingLeader.label} sebagai ketua ${selectedGroupName || 'kelompok'}?`, { title: 'Tetapkan ketua', confirmLabel: 'Tetapkan' });
    if (!ok) return;
    setBusy(true); setMessage('');
    try {
      await setGroupLeader(selectedGroup, pendingLeader.userId);
      const row = await saveRandomizerResult(activeClass, 'group_leader', `Ketua ${selectedGroupName || 'Kelompok'}`, [pendingLeader.label]);
      setHistory(prev => [row, ...prev]);
      setMessage(`${pendingLeader.label} ditetapkan sebagai ketua ${selectedGroupName || 'kelompok'}.`);
      showToast('Ketua kelompok berhasil ditetapkan.', 'good');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal menetapkan ketua.'); }
    finally { setBusy(false); }
  };

  const manualLeader = async (userId: string, name: string) => {
    if (!selectedGroup || busy) return;
    const ok = await requestConfirm(`Tetapkan ${name} sebagai ketua ${selectedGroupName || 'kelompok'}?`, { title: 'Tetapkan ketua', confirmLabel: 'Tetapkan' });
    if (!ok) return;
    setBusy(true); setMessage('');
    try {
      await setGroupLeader(selectedGroup, userId);
      setResult([{ key: userId, userId, label: name, meta: 'Ketua terpilih' }]);
      const row = await saveRandomizerResult(activeClass, 'group_leader', `Ketua ${selectedGroupName || 'Kelompok'}`, [name]);
      setHistory(prev => [row, ...prev]);
      setMessage(`${name} ditetapkan sebagai ketua.`); showToast('Ketua kelompok berhasil ditetapkan.', 'good');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal menetapkan ketua.'); }
    finally { setBusy(false); }
  };

  const canSave = !!activeClass && !!result.length && (mode !== 'presentation_order' || result.length === items.length);

  const saveResult = async () => {
    if (!activeClass || !canSave || busy) return;
    if (mode === 'presentation_order' && presentation.saveToCalendar) {
      if (!presentation.date) { setMessage('Pilih tanggal presentasi terlebih dahulu.'); return; }
      if (!presentation.start) { setMessage('Pilih jam mulai presentasi terlebih dahulu.'); return; }
      const duration = Math.max(1, Number(presentation.duration) || 15);
      const gap = Math.max(0, Number(presentation.gap) || 0);
      try {
        const last = sameDayTimes(presentation.start, duration, result.length - 1, gap);
        if (last.endMinutes > 24 * 60) throw new Error('JADWAL_PRESENTASI_MELEWATI_HARI');
      } catch (e) { setMessage(e instanceof Error ? e.message : 'Jadwal presentasi tidak valid.'); return; }
    }
    setBusy(true); setMessage('');
    try {
      const title = mode === 'group_leader' ? `Ketua ${selectedGroupName || 'Kelompok'}` : mode === 'presentation_order' ? 'Urutan Presentasi' : 'Random Anggota';
      if (mode === 'presentation_order' && presentation.saveToCalendar) {
        const duration = Math.max(1, Number(presentation.duration) || 15);
        const gap = Math.max(0, Number(presentation.gap) || 0);
        const events = result.map((item, index) => {
          const times = sameDayTimes(presentation.start, duration, index, gap);
          const start = new Date(`${presentation.date}T${times.start}`);
          const end = new Date(`${presentation.date}T${times.end}`);
          return { item, startsAt: start.toISOString(), endsAt: end.toISOString() };
        });
        for (let i = 0; i < events.length; i += 1) {
          await createClassEvent(activeClass, {
            eventType: 'presentation',
            title: `Presentasi #${i + 1} — ${events[i].item.label}`,
            description: `Urutan presentasi #${i + 1} dari hasil Randomizer Kelas.`,
            startsAt: events[i].startsAt,
            endsAt: events[i].endsAt,
            location: presentation.location || null,
            meetingUrl: presentation.meetingUrl || null,
            pinned: true,
          });
        }
      }
      const row = await saveRandomizerResult(activeClass, mode, title, result.map(item => item.label));
      setHistory(prev => [row, ...prev]);
      setMessage(mode === 'presentation_order' && presentation.saveToCalendar
        ? 'Urutan tersimpan dan jadwal presentasi sudah masuk ke kalender.'
        : 'Hasil randomizer berhasil disimpan.');
      showToast('Hasil randomizer tersimpan.', 'good');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal menyimpan hasil.'); }
    finally { setBusy(false); }
  };

  const reset = () => {
    setResult([]); setRemaining(items); setTargetIndex(-1); setPendingLeader(null); setMessage('');
  };

  return <div className="stack-page randomizer-page">
    <div className="mobile-page-head"><button className="mobile-back" onClick={() => activeClass ? openClassModule(activeClass, `/classes/${activeClass}`) : nav('/classes')} aria-label="Kembali">‹</button><div><h2>Randomizer</h2><small>Undian kelas yang transparan dan mudah</small></div></div>
    {message && <div className="alert alert-info" role="status">{message}</div>}

    <Card className="randomizer-hero-card">
      <div className="randomizer-class-row"><div><span className="eyebrow">Kelas aktif</span><strong>{classes.find(c => c.id === activeClass)?.name || 'Pilih kelas'}</strong></div><select value={activeClass} onChange={e => { setActiveClass(e.target.value); setActiveClassId(e.target.value); }} aria-label="Pilih kelas">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="section-head randomizer-section-head"><div><span className="eyebrow">Randomizer Kelas</span><h3>🎡 Pilih secara acak</h3><p className="muted">{subtitle}</p></div><Badge tone="info">{result.length}/{items.length}</Badge></div>

      <div className="tabbar randomizer-mode-tabs" role="tablist">
        <button className={mode === 'group_leader' ? 'active' : ''} onClick={() => setMode('group_leader')}>Ketua Kelompok</button>
        <button className={mode === 'presentation_order' ? 'active' : ''} onClick={() => setMode('presentation_order')}>Urutan Presentasi</button>
        <button className={mode === 'member_random' ? 'active' : ''} onClick={() => setMode('member_random')}>Random Anggota</button>
      </div>

      {mode === 'group_leader' && <>
        <div className="segmented-control" role="tablist" aria-label="Metode memilih ketua"><button className={leaderMethod === 'wheel' ? 'active' : ''} onClick={() => setLeaderMethod('wheel')}>🎡 Roda Putar</button><button className={leaderMethod === 'manual' ? 'active' : ''} onClick={() => setLeaderMethod('manual')}>☑ Manual</button></div>
        <label className="field randomizer-select"><span>Pilih kelompok</span><select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        {leaderMethod === 'manual' && <div className="manual-leader-list">{groupMembers.length ? groupMembers.map(m => { const name = m.full_name || m.nim || m.user_id; return <button key={m.id} disabled={busy} className="manual-leader-row" onClick={() => void manualLeader(m.user_id, name)}><span className="manual-avatar">{name.slice(0, 1).toUpperCase()}</span><span><strong>{name}</strong><small>{m.nim || 'Anggota aktif'}</small></span><b>›</b></button>; }) : <Empty title="Belum ada anggota kelompok" body="Pilih kelompok yang memiliki anggota aktif."/>}</div>}
      </>}

      {mode === 'presentation_order' && <Card className="presentation-plan-card"><div className="section-head"><div><span className="eyebrow">Jadwal opsional</span><h3>Atur presentasi</h3></div><Badge tone="info">Terhubung Kalender</Badge></div><div className="grid-form"><label className="field"><span>Tanggal</span><input type="date" value={presentation.date} onChange={e => setPresentation(v => ({ ...v, date: e.target.value }))} /></label><label className="field"><span>Mulai</span><input type="time" value={presentation.start} onChange={e => setPresentation(v => ({ ...v, start: e.target.value }))} /></label><label className="field"><span>Durasi / kelompok (menit)</span><input type="number" min="1" max="180" value={presentation.duration} onChange={e => setPresentation(v => ({ ...v, duration: e.target.value }))} /></label><label className="field"><span>Jeda (menit)</span><input type="number" min="0" max="60" value={presentation.gap} onChange={e => setPresentation(v => ({ ...v, gap: e.target.value }))} /></label><label className="field"><span>Ruangan / lokasi</span><input maxLength={180} value={presentation.location} onChange={e => setPresentation(v => ({ ...v, location: e.target.value }))} /></label><label className="field"><span>Meeting URL</span><input type="url" value={presentation.meetingUrl} onChange={e => setPresentation(v => ({ ...v, meetingUrl: e.target.value }))} /></label><label className="check-row span-2"><input type="checkbox" checked={presentation.saveToCalendar} onChange={e => setPresentation(v => ({ ...v, saveToCalendar: e.target.checked }))} /><span>Simpan setiap urutan sebagai event kalender</span></label></div></Card>}

      {mode !== 'group_leader' || leaderMethod === 'wheel' ? <div className="randomizer-stage">
        <Wheel items={remaining} spinKey={spinKey} targetIndex={targetIndex} />
        <div className="randomizer-side"><span className="eyebrow">{mode === 'presentation_order' ? 'URUTAN PRESENTASI' : mode === 'group_leader' ? 'PEMILIHAN KETUA' : 'RANDOM ANGGOTA'}</span><h3>{mode === 'presentation_order' ? 'Susun urutan tanpa memilih manual.' : mode === 'group_leader' ? 'Undi dulu, konfirmasi kemudian.' : 'Tentukan satu mahasiswa dengan cepat.'}</h3><p className="muted">{subtitle}</p><div className="randomizer-actions"><Button onClick={spin} disabled={busy || !remaining.length}>{busy ? 'Memutar…' : mode === 'presentation_order' ? 'Putar berikutnya' : 'Putar Roda'}</Button><Button variant="ghost" onClick={reset} disabled={busy}>Mulai lagi</Button></div><small className="randomizer-remaining">{mode === 'presentation_order' ? `Sudah dipilih ${result.length} dari ${items.length}` : result.length ? 'Hasil sudah ditentukan' : `Kandidat ${items.length}`}</small></div>
      </div> : null}

      {mode === 'group_leader' && leaderMethod === 'wheel' && pendingLeader && <div className="randomizer-winner-card"><div><span className="eyebrow">Hasil undian</span><strong>{pendingLeader.label}</strong><small>{pendingLeader.meta || 'Calon ketua'}</small></div><Button disabled={busy} onClick={() => void setWheelLeader()}>Tetapkan sebagai Ketua</Button></div>}
    </Card>

    <div className="grid-2">
      <Card><div className="section-head"><div><span className="eyebrow">Hasil</span><h3>{mode === 'presentation_order' ? 'Urutan Presentasi' : mode === 'group_leader' ? 'Ketua Kelompok' : 'Hasil Random'}</h3></div>{result.length > 0 && <Badge tone="good">{result.length} hasil</Badge>}</div>
        {result.length ? <div className="randomizer-result-list">{result.map((item, i) => <div className="randomizer-result-row" key={`${item.key}-${i}`}><b>{i + 1}</b><div><strong>{item.label}</strong>{item.meta && <small>{item.meta}</small>}{mode === 'presentation_order' && <small>Presentasi #{i + 1}</small>}</div>{mode === 'presentation_order' && <span className="result-chip">#{i + 1}</span>}</div>)}</div> : <Empty title="Belum ada hasil" body={mode === 'presentation_order' ? 'Putar sampai semua kelompok mendapatkan nomor urut.' : 'Hasil pilihan akan tampil di sini.'} />}
        {mode === 'presentation_order' && result.length > 0 && result.length < items.length && <div className="alert alert-info">Masih ada {items.length - result.length} kelompok yang belum terpilih.</div>}
        <div className="form-actions"><Button onClick={() => void saveResult()} disabled={busy || !canSave}>{mode === 'presentation_order' && presentation.saveToCalendar ? 'Simpan & Jadwalkan' : 'Simpan hasil'}</Button></div>
      </Card>
      <Card><div className="section-head"><div><span className="eyebrow">Riwayat</span><h3>Hasil tersimpan</h3></div></div>{history.length ? history.slice(0, 8).map(h => <div className="history-row" key={h.id}><div><strong>{h.title}</strong><small>{new Date(h.created_at).toLocaleString('id-ID')} · {h.entries.length} hasil</small>{h.mode === 'presentation_order' && <div className="history-preview">{h.entries.slice(0, 5).map((entry, index) => <span key={`${h.id}-${index}`}>{index + 1}. {entry}</span>)}{h.entries.length > 5 && <span>+{h.entries.length - 5} lainnya</span>}</div>}</div><Badge tone="neutral">{h.mode === 'presentation_order' ? 'Presentasi' : h.mode === 'group_leader' ? 'Ketua' : 'Random'}</Badge></div>) : <Empty title="Belum ada riwayat" body="Hasil yang disimpan akan muncul di sini." />}</Card>
    </div>
  </div>;
}
