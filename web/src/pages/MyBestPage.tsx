import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button, Badge, Card } from '../components/ui';

const MYBEST_URL = 'https://elearning.bsi.ac.id/';
const FUNCTION_NAME = 'mybest-import';

type ImportCategory = 'schedule' | 'assignment' | 'material' | 'announcement' | 'other';

type MyBestItem = {
  id: string;
  kind: ImportCategory;
  title: string;
  source_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  due_at: string | null;
  subject: string | null;
  room: string | null;
  data: Record<string, unknown>;
  captured_at: string;
};

type MyBestRun = {
  id: string;
  status: string;
  source_url: string | null;
  imported_items: number;
  created_at: string;
};

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatDate(value: string | null) {
  if (!value) return 'â€”';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function categoryLabel(value: ImportCategory) {
  return {
    schedule: 'Jadwal',
    assignment: 'Tugas',
    material: 'Materi',
    announcement: 'Pengumuman',
    other: 'Lainnya',
  }[value];
}

export function MyBestPage() {
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [items, setItems] = useState<MyBestItem[]>([]);
  const [runs, setRuns] = useState<MyBestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [{ data: itemData, error: itemError }, { data: runData, error: runError }] = await Promise.all([
        supabase.from('mybest_sync_items').select('id,kind,title,source_url,starts_at,ends_at,due_at,subject,room,data,captured_at').order('captured_at', { ascending: false }).limit(100),
        supabase.from('mybest_sync_runs').select('id,status,source_url,imported_items,created_at').order('created_at', { ascending: false }).limit(10),
      ]);
      if (itemError) throw itemError;
      if (runError) throw runError;
      setItems((itemData ?? []) as MyBestItem[]);
      setRuns((runData ?? []) as MyBestRun[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data MyBest tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeItems = useMemo(() => items.filter(item => item.kind !== 'other'), [items]);

  async function createToken() {
    if (!supabase) return;
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const raw = randomToken();
      const hash = await sha256Hex(raw);
      const { data, error: rpcError } = await supabase.rpc('create_mybest_import_token', {
        p_token_hash: hash,
        p_expires_seconds: 600,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      setToken(raw);
      setExpiresAt(row?.expires_at ?? new Date(Date.now() + 600000).toISOString());
      setMessage('Kode sinkron siap. Gunakan sekali dari ekstensi MyBest, lalu kode otomatis mati.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode sinkron gagal dibuat.');
    } finally {
      setCreating(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setMessage('Kode sinkron disalin.');
  }

  if (!supabase) return <Card><strong>Supabase belum tersedia.</strong></Card>;

  return <div className="stack-lg">
    <div className="page-heading">
      <div><span className="eyebrow">Integrasi</span><h1>MyBest</h1><p className="muted">Ambil data yang sedang kamu buka di MyBest dan simpan ke Inside Code tanpa menyimpan password MyBest.</p></div>
      <a className="btn btn-soft" href={MYBEST_URL} target="_blank" rel="noreferrer">Buka MyBest</a>
    </div>

    {error && <Card className="notice notice-error"><strong>Gagal</strong><p>{error}</p></Card>}
    {message && <Card className="notice notice-good"><strong>Siap</strong><p>{message}</p></Card>}

    <Card>
      <div className="section-head"><div><span className="eyebrow">Cara kerja</span><h3>Sinkronisasi manual yang aman</h3></div><Badge tone="good">Tanpa password MyBest</Badge></div>
      <ol className="stack-sm muted">
        <li>Login sendiri ke MyBest di browser seperti biasa.</li>
        <li>Buka halaman Jadwal, Tugas, Materi, atau Pengumuman.</li>
        <li>Buat kode sinkron di sini, lalu masukkan ke ekstensi Inside Code MyBest Sync.</li>
        <li>Ekstensi membaca data yang sedang tampil dan mengirimkannya ke Inside Code.</li>
        <li>Kode otomatis sekali pakai dan kedaluwarsa setelah 10 menit.</li>
      </ol>
      <div className="button-row"><Button onClick={()=>void createToken()} disabled={creating}>{creating ? 'Membuat kodeâ€¦' : 'Buat kode sinkron'}</Button>{token && <Button variant="soft" onClick={()=>void copyToken()}>Salin kode</Button>}</div>
      {token && <div className="stack-sm" style={{ marginTop: 14 }}>
        <code className="mono-block">{token}</code>
        <small className="muted">Berlaku sampai {formatDate(expiresAt)}</small>
      </div>}
    </Card>

    <Card>
      <div className="section-head"><div><span className="eyebrow">Data tersimpan</span><h3>{activeItems.length} item</h3></div><Button variant="ghost" onClick={()=>void load()} disabled={loading}>{loading ? 'Memuatâ€¦' : 'Refresh'}</Button></div>
      {activeItems.length === 0 ? <div className="empty"><strong>Belum ada data MyBest</strong><span>Login ke MyBest dan jalankan sinkronisasi dari halaman yang sedang dibuka.</span></div> : <div className="list-stack">{activeItems.map(item => <article key={item.id} className="list-row"><div className="list-main"><div className="item-meta"><Badge tone="info">{categoryLabel(item.kind)}</Badge>{item.subject && <span>{item.subject}</span>}</div><strong>{item.title}</strong><small>{item.room ? `${item.room} Â· ` : ''}{item.due_at ? `Deadline ${formatDate(item.due_at)}` : item.starts_at ? `${formatDate(item.starts_at)}${item.ends_at ? `â€“${formatDate(item.ends_at)}` : ''}` : `Diambil ${formatDate(item.captured_at)}`}</small></div>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="btn btn-ghost">Buka</a>}</article>)}</div>}
    </Card>

    <Card>
      <div className="section-head"><div><span className="eyebrow">Riwayat</span><h3>Sinkronisasi terbaru</h3></div></div>
      {runs.length === 0 ? <div className="empty"><strong>Belum ada riwayat</strong></div> : <div className="list-stack">{runs.map(run => <div key={run.id} className="list-row"><div className="list-main"><strong>{run.status === 'success' ? 'Sinkronisasi berhasil' : 'Sinkronisasi gagal'}</strong><small>{run.imported_items} item Â· {formatDate(run.created_at)}{run.source_url ? ` Â· ${new URL(run.source_url).pathname}` : ''}</small></div><Badge tone={run.status === 'success' ? 'good' : 'danger'}>{run.status}</Badge></div>)}</div>}
    </Card>
  </div>;
}
