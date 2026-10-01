import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Field } from '../components/ui';
import { getProfile, listClasses, listSubjects } from '../lib/repository';
import { getActiveClassId, nav, setActiveClassId } from '../lib/router';
import type { ClassRecord, Profile, Subject } from '../types/models';
import { showToast } from '../components/ToastHost';

type MessagePreset = { id: string; label: string; icon: string; intro: string; helper: string; make: (ctx: MessageContext) => string };
type MessageContext = { studentName: string; nim: string; className: string; subject: string; lecturerName: string; date: string; time: string; reason: string; extra: string };

const PRESETS: MessagePreset[] = [
  { id: 'permission', label: 'Izin tidak masuk', icon: '◷', intro: 'Izin tidak mengikuti perkuliahan', helper: 'Untuk izin karena kondisi tertentu.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), mahasiswa dari kelas ${c.className || '[Kelas]'}. Saya ingin memohon izin tidak dapat mengikuti perkuliahan ${c.subject ? `mata kuliah ${c.subject}` : 'hari ini'} pada ${c.date || '[tanggal]'}${c.time ? ` pukul ${c.time}` : ''} karena ${c.reason || '[alasan]'}.\n\nSaya akan mengejar materi dan tugas yang diberikan. Mohon izin dan pengertiannya.\n\nTerima kasih.`, },
  { id: 'late', label: 'Izin terlambat', icon: '↗', intro: 'Izin datang terlambat', helper: 'Cocok untuk keterlambatan menuju kelas.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), kelas ${c.className || '[Kelas]'}. Saya mohon izin datang terlambat untuk ${c.subject ? `mata kuliah ${c.subject}` : 'perkuliahan'} hari ini karena ${c.reason || '[alasan]'}. Saya berangkat dan akan segera menuju kelas.\n\nMohon izin dan pengertiannya. Terima kasih.`, },
  { id: 'sick', label: 'Izin sakit', icon: '✚', intro: 'Izin karena sakit', helper: 'Gunakan bila kondisi kesehatan membuatmu tidak dapat mengikuti kelas.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), mahasiswa kelas ${c.className || '[Kelas]'}. Saya ingin memohon izin tidak mengikuti ${c.subject ? `mata kuliah ${c.subject}` : 'perkuliahan'} pada ${c.date || '[tanggal]'} karena sedang sakit. ${c.extra || ''}\n\nSaya akan menyesuaikan materi dan tugas setelah kondisi membaik. Mohon izin dan pengertiannya.\n\nTerima kasih.`, },
  { id: 'family', label: 'Keperluan keluarga', icon: '⌂', intro: 'Izin karena keperluan keluarga', helper: 'Pesan formal singkat untuk keperluan keluarga.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), kelas ${c.className || '[Kelas]'}. Saya memohon izin tidak dapat mengikuti ${c.subject ? `mata kuliah ${c.subject}` : 'perkuliahan'} pada ${c.date || '[tanggal]'} karena ada keperluan keluarga yang tidak dapat ditinggalkan.\n\nMohon izin dan pengertiannya. Saya akan mengejar materi/tugas yang tertinggal.\n\nTerima kasih.`, },
  { id: 'assignment', label: 'Kirim tugas', icon: '✓', intro: 'Konfirmasi pengumpulan tugas', helper: 'Pesan saat tugas sudah dikirim atau akan dikirim.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), dari kelas ${c.className || '[Kelas]'}. Saya ingin menginformasikan bahwa tugas ${c.subject ? `mata kuliah ${c.subject}` : ''} telah saya kumpulkan${c.date ? ` pada ${c.date}` : ''}. ${c.extra || ''}\n\nMohon diperiksa apabila sudah diterima. Terima kasih.`, },
  { id: 'material', label: 'Minta materi', icon: '▤', intro: 'Meminta materi perkuliahan', helper: 'Untuk materi yang terlewat atau belum diterima.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), kelas ${c.className || '[Kelas]'}. Mohon izin bertanya, apakah saya dapat meminta materi ${c.subject ? `untuk mata kuliah ${c.subject}` : 'perkuliahan'}${c.date ? ` pada ${c.date}` : ''}? Saya ingin memastikan materi yang saya pelajari sesuai dengan pertemuan.\n\nTerima kasih.`, },
  { id: 'consultation', label: 'Konsultasi', icon: '?', intro: 'Meminta waktu konsultasi', helper: 'Pesan untuk bertanya atau meminta arahan.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}) dari kelas ${c.className || '[Kelas]'}. Saya ingin berkonsultasi mengenai ${c.subject ? `mata kuliah ${c.subject}` : 'perkuliahan'} terkait ${c.reason || '[topik yang ingin ditanyakan]'}.\n\nApakah Bapak/Ibu berkenan memberikan waktu untuk konsultasi? ${c.extra || ''}\n\nTerima kasih.`, },
  { id: 'schedule', label: 'Konfirmasi jadwal', icon: '▣', intro: 'Konfirmasi jadwal/presentasi', helper: 'Untuk memastikan waktu atau agenda.', make: c => `Assalamu’alaikum ${c.lecturerName || 'Bapak/Ibu Dosen'},\n\nSaya ${c.studentName || '[Nama]'} (NIM ${c.nim || '[NIM]'}), kelas ${c.className || '[Kelas]'}. Izin mengonfirmasi ${c.subject ? `jadwal ${c.subject}` : 'jadwal perkuliahan/presentasi'} pada ${c.date || '[tanggal]'}${c.time ? ` pukul ${c.time}` : ''}.\n\nMohon konfirmasi apabila ada perubahan. Terima kasih.`, },
  { id: 'custom', label: 'Pesan lainnya', icon: '✎', intro: 'Pesan bebas', helper: 'Tulis pesan sendiri lalu buka WhatsApp.', make: c => c.extra || '[Tulis pesanmu di area pesan.]', },
];

const CONTACT_KEY = 'inside-code-quick-message-contact';

function formatDateId(raw: string) {
  if (!raw) return '';
  const value = new Date(`${raw}T00:00:00`);
  return Number.isNaN(value.getTime()) ? raw : value.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function normalizeWhatsApp(raw: string) {
  const digits = raw.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
}

export function QuickMessagesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState(getActiveClassId());
  const [presetId, setPresetId] = useState('permission');
  const [phone, setPhone] = useState(localStorage.getItem(CONTACT_KEY) || '');
  const [lecturerName, setLecturerName] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [extra, setExtra] = useState('');
  const [saveContact, setSaveContact] = useState(Boolean(localStorage.getItem(CONTACT_KEY)));
  useEffect(() => {
    void Promise.all([getProfile(), listClasses()]).then(([p, cs]) => {
      setProfile(p); setClasses(cs);
      const first = cs.find(c => c.id === getActiveClassId()) ?? cs[0];
      if (first) { setClassId(first.id); setClassName(first.class_code || first.name || ''); }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!classId) { setSubjects([]); return; }
    setActiveClassId(classId);
    void listSubjects(classId).then(setSubjects).catch(() => setSubjects([]));
  }, [classId]);

  const preset = useMemo(() => PRESETS.find(x => x.id === presetId) ?? PRESETS[0], [presetId]);
  const message = useMemo(() => preset.make({
    studentName: profile?.full_name || '', nim: profile?.nim || '', className, subject, lecturerName, date: formatDateId(date), time, reason, extra,
  }), [preset, profile, className, subject, lecturerName, date, time, reason, extra]);
  const whatsappNumber = normalizeWhatsApp(phone);
  const canSend = whatsappNumber.length >= 10 && message.trim().length > 10;
  const whatsappUrl = canSend ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : '';

  const openWhatsApp = () => {
    if (!canSend) { showToast('Isi nomor WhatsApp dosen dan pesan terlebih dahulu.', 'warn'); return; }
    if (saveContact) localStorage.setItem(CONTACT_KEY, phone); else localStorage.removeItem(CONTACT_KEY);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    showToast('Membuka WhatsApp dengan pesan yang sudah diisi.', 'good');
  };

  return <div className="stack-page quick-messages-page">
    <div className="mobile-page-head page-title">
      <div><span className="eyebrow">Komunikasi</span><h2>Pesan Cepat</h2><p>Pesan siap kirim ke dosen melalui WhatsApp.</p></div>
      <div className="button-row quick-page-head-actions"><Button variant="ghost" onClick={() => nav('/help')}>Bantuan</Button><Button variant="ghost" onClick={() => nav('/dashboard')}>Kembali</Button></div>
    </div>

    <Card className="quick-message-hero">
      <div className="quick-message-icon">✦</div>
      <div><span className="eyebrow">WhatsApp helper</span><h3>Pilih template, periksa pesan, lalu kirim.</h3><p className="muted">Inside Code tidak mengirim pesan otomatis. Tombol di bawah hanya membuka WhatsApp dengan teks yang sudah disiapkan.</p></div>
    </Card>

    <Card>
      <div className="section-head"><div><span className="eyebrow">1 · Jenis pesan</span><h3>Pilih kebutuhan</h3></div><Badge tone="info">{PRESETS.length} template</Badge></div>
      <div className="quick-message-presets">{PRESETS.map(item => <button type="button" key={item.id} className={presetId === item.id ? 'active' : ''} onClick={() => setPresetId(item.id)}><span className="quick-message-preset-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.helper}</small></span></button>)}</div>
    </Card>

    <Card>
      <div className="section-head"><div><span className="eyebrow">2 · Penerima</span><h3>Data pesan</h3></div><Badge tone="good">Login aktif</Badge></div>
      <div className="grid-form">
        <Field label="Nama dosen"><input value={lecturerName} onChange={e => setLecturerName(e.target.value)} placeholder="Contoh: Pak Budi" /></Field>
        <Field label="Nomor WhatsApp dosen"><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" /></Field>
        <Field label="Kelas"><select value={classId} onChange={e => { const id=e.target.value; setClassId(id); const c=classes.find(x=>x.id===id); setClassName(c?.class_code || c?.name || ''); }}><option value="">Pilih kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.class_code} · {c.name}</option>)}</select></Field>
        <Field label="Mata kuliah"><select value={subject} onChange={e => setSubject(e.target.value === "__custom" ? "" : e.target.value)}><option value="">Pilih mata kuliah</option>{subjects.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}<option value="__custom">Tulis manual…</option></select>{(subjects.length===0 || subject === "") && <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Nama mata kuliah" />}</Field>
        <Field label="Tanggal"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Jam"><input type="time" value={time} onChange={e => setTime(e.target.value)} /></Field>
        <Field label="Alasan / topik"><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Contoh: kondisi kurang sehat" /></Field>
        <Field label={presetId === 'custom' ? 'Isi pesan' : 'Tambahan pesan'}><textarea value={extra} onChange={e => setExtra(e.target.value)} rows={3} placeholder={presetId === 'custom' ? 'Tulis pesan lengkap di sini…' : 'Tambahkan informasi bila diperlukan…'} /></Field>
      </div>
      <label className="quick-message-save"><input type="checkbox" checked={saveContact} onChange={e => setSaveContact(e.target.checked)} /> Simpan nomor ini hanya di perangkat untuk pemakaian berikutnya</label>
    </Card>

    <Card className="quick-message-preview-card">
      <div className="section-head"><div><span className="eyebrow">3 · Preview</span><h3>{preset.intro}</h3></div><Badge tone="info">WhatsApp</Badge></div>
      <div className="whatsapp-preview"><div className="whatsapp-preview-head"><span>WhatsApp</span><small>{lecturerName || 'Bapak/Ibu Dosen'}</small></div><p>{message}</p></div>
      <div className="button-row quick-message-actions"><Button onClick={openWhatsApp} disabled={!canSend}>Buka WhatsApp</Button><Button variant="ghost" onClick={() => { void navigator.clipboard?.writeText(message).then(() => showToast('Pesan disalin.', 'good')).catch(() => showToast('Pesan tidak dapat disalin otomatis.', 'warn')); }}>Salin pesan</Button></div>
      <p className="muted quick-message-note">Nomor dan isi pesan tidak disimpan ke server Inside Code. Pengiriman dilakukan di aplikasi WhatsApp kamu.</p>
    </Card>
  </div>;
}
