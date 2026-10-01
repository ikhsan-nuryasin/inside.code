import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, Card, Field } from '../components/ui';
import { createBugReport, listBugReports } from '../lib/repository';
import { nav } from '../lib/router';
import type { BugReport, BugReportCategory, BugSeverity } from '../types/models';
import { showToast } from '../components/ToastHost';

const FAQ = [
  ['Bagaimana Inside Code tetap bisa dipakai offline?', 'Data yang sudah pernah tersimpan di perangkat dapat dibaca saat offline. Perubahan yang didukung akan masuk antrean sinkronisasi dan dikirim kembali ketika koneksi tersedia.'],
  ['Kenapa perubahan saya belum terlihat di perangkat lain?', 'Periksa status sinkronisasi. Saat offline atau koneksi tidak stabil, perubahan dapat menunggu di outbox sampai proses sinkronisasi berhasil.'],
  ['Bagaimana cara membuka fitur kelas lain?', 'Masuk ke Kelas, pilih kelas yang diinginkan, lalu gunakan semua fitur kelas dari halaman Detail Kelas.'],
  ['Bagaimana cara mengirim pesan ke dosen?', 'Gunakan Pesan Cepat untuk membuat pesan siap kirim. Isi nomor WhatsApp dosen, periksa preview, lalu buka WhatsApp.'],
  ['Apakah Inside Code menyimpan nomor WhatsApp dosen?', 'Nomor penerima pada Pesan Cepat hanya disimpan lokal pada perangkat bila kamu memilih menyimpannya. Tidak dikirim ke server Inside Code.'],
] as const;

const CATEGORY_LABEL: Record<BugReportCategory, string> = {
  ui: 'Tampilan / UI',
  feature: 'Fitur',
  performance: 'Performa',
  offline_sync: 'Offline / Sinkronisasi',
  account: 'Akun / Login',
  other: 'Lainnya',
};
const SEVERITY_LABEL: Record<BugSeverity, string> = {
  low: 'Rendah', medium: 'Sedang', high: 'Tinggi', critical: 'Kritis',
};
const STATUS_LABEL: Record<BugReport['status'], string> = {
  open: 'Diterima', reviewing: 'Sedang diperiksa', resolved: 'Selesai', closed: 'Ditutup',
};

export function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', category: 'ui' as BugReportCategory, severity: 'medium' as BugSeverity,
    description: '', steps: '', expected: '', actual: '', pagePath: location.hash || '/',
  });

  const refresh = async () => {
    try { setReports(await listBugReports()); } catch (e) { setError(e instanceof Error ? e.message : 'Riwayat laporan tidak dapat dimuat.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const recent = useMemo(() => reports.slice(0, 5), [reports]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      const report = await createBugReport({
        title: form.title, category: form.category, severity: form.severity,
        description: form.description, steps: form.steps, expectedBehavior: form.expected,
        actualBehavior: form.actual, pagePath: form.pagePath || location.hash || '/',
      });
      setInfo(`Laporan ${report.id.slice(0, 8)} berhasil dikirim.`);
      showToast('Laporan bug berhasil disimpan.', 'good');
      setReports(prev => [report, ...prev.filter(x => x.id !== report.id)]);
      setForm({ title: '', category: 'ui', severity: 'medium', description: '', steps: '', expected: '', actual: '', pagePath: location.hash || '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laporan gagal dikirim.');
      showToast('Laporan bug gagal dikirim.', 'danger');
    } finally { setBusy(false); }
  };

  return <div className="stack-page support-page">
    <div className="mobile-page-head page-title">
      <div>
        <span className="eyebrow">Support</span>
        <h2>Bantuan</h2>
        <p>Pusat bantuan, panduan singkat, dan laporan bug Inside Code.</p>
      </div>
      <div className="button-row quick-page-head-actions"><Button variant="soft" onClick={() => nav('/quick-messages')}>Pesan Cepat</Button><Button variant="ghost" onClick={() => nav('/dashboard')}>Kembali</Button></div>
    </div>

    <Card className="support-hero-card">
      <div className="support-hero-icon">?</div>
      <div>
        <span className="eyebrow">Butuh bantuan?</span>
        <h3>Cari jawaban dulu, lalu laporkan masalah yang benar-benar terjadi.</h3>
        <p className="muted">Laporan bug terhubung ke akun login kamu dan otomatis menyimpan halaman tempat laporan dibuat.</p>
      </div>
    </Card>

    <Card>
      <div className="section-head"><div><span className="eyebrow">FAQ</span><h3>Pertanyaan umum</h3></div><Badge tone="info">Bantuan</Badge></div>
      <div className="support-faq-list">
        {FAQ.map(([q, a], i) => <div className={`support-faq ${openFaq === i ? 'open' : ''}`} key={q}>
          <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
            <strong>{q}</strong><span>{openFaq === i ? '−' : '+'}</span>
          </button>
          {openFaq === i && <p>{a}</p>}
        </div>)}
      </div>
    </Card>

    <Card className="support-report-card">
      <div className="section-head"><div><span className="eyebrow">Bug report</span><h3>Laporkan bug</h3></div><Badge tone="warn">Login aktif</Badge></div>
      <p className="muted">Jelaskan masalah secara spesifik agar lebih mudah ditelusuri. Informasi perangkat dan halaman dicatat otomatis.</p>
      <form className="grid-form" onSubmit={submit}>
        <Field label="Judul masalah"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={200} placeholder="Contoh: tombol Simpan tidak merespons" /></Field>
        <Field label="Kategori"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as BugReportCategory })}>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Tingkat masalah"><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as BugSeverity })}>{Object.entries(SEVERITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Halaman"><input value={form.pagePath} onChange={e => setForm({ ...form, pagePath: e.target.value })} placeholder="#/kelas/…" /></Field>
        <Field label="Deskripsi"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={4} placeholder="Apa yang terjadi?" /></Field>
        <Field label="Langkah reproduksi"><textarea value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} rows={4} placeholder="1. Buka…\n2. Tekan…\n3. Terjadi…" /></Field>
        <Field label="Hasil yang diharapkan"><textarea value={form.expected} onChange={e => setForm({ ...form, expected: e.target.value })} rows={3} placeholder="Seharusnya…" /></Field>
        <Field label="Hasil yang terjadi"><textarea value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} rows={3} placeholder="Yang muncul justru…" /></Field>
        {error && <div className="alert alert-danger span-2">{error}</div>}
        {info && <div className="alert alert-info span-2">{info}</div>}
        <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan bug'}</Button></div>
      </form>
    </Card>

    <Card>
      <div className="section-head"><div><span className="eyebrow">Riwayat</span><h3>Laporan saya</h3></div><Button variant="ghost" onClick={() => void refresh()}>Segarkan</Button></div>
      {loading ? <div className="empty"><strong>Memuat laporan…</strong></div> : recent.length === 0 ? <div className="empty"><strong>Belum ada laporan bug</strong><span>Masalah yang kamu laporkan akan muncul di sini.</span></div> : recent.map(r => <div className="support-report-row" key={r.id}>
        <div><strong>{r.title}</strong><small>{CATEGORY_LABEL[r.category]} · {SEVERITY_LABEL[r.severity]} · {new Date(r.created_at).toLocaleString('id-ID')}</small></div>
        <Badge tone={r.status === 'resolved' || r.status === 'closed' ? 'good' : r.severity === 'critical' || r.severity === 'high' ? 'danger' : 'info'}>{STATUS_LABEL[r.status]}</Badge>
      </div>)}
    </Card>
  </div>;
}
