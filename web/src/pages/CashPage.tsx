import { getActiveClassId, setActiveClassId } from '../lib/router';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Field } from '../components/ui';
import {
  correctCashTransaction,
  createCashDue,
  createCashPayment,
  createCashTransaction,
  getCashMonthlySummary,
  getClassPosition,
  listCashDuesWithPayments,
  listCashTransactionsByMonth,
  listClasses,
  attachCashPaymentProof,
  verifyCashPayment,
  voidCashTransaction,
  currentUserId,
} from '../lib/repository';
import type { CashDue, CashPayment, CashMonthlySummary, CashTransaction, ClassPositionRecord, ClassRecord } from '../types/models';
import { hasCapability, POSITION_LABEL } from '../lib/permissions';
import { requestPrompt } from '../components/DialogHost';

const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const shiftMonth = (month: string, delta: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const initialMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
const daysInMonth = (month: string) => { const [year, rawMonth] = month.split('-').map(Number); return new Date(year, rawMonth, 0).getDate(); };

export function CashPage() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [active, setActive] = useState('');
  const [position, setPosition] = useState<ClassPositionRecord | null>(null);
  const [tx, setTx] = useState<CashTransaction[]>([]);
  const [dues, setDues] = useState<Array<CashDue & { payments: CashPayment[] }>>([]);
  const [summary, setSummary] = useState<CashMonthlySummary>({ opening_balance: 0, total_income: 0, total_expense: 0, net_change: 0, closing_balance: 0, transaction_count: 0, month_start: `${initialMonth}-01` });
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [month, setMonth] = useState(initialMonth);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofs, setProofs] = useState<Record<string, File>>({});
  const [correction, setCorrection] = useState<CashTransaction | null>(null);
  const [form, setForm] = useState({ type: 'income' as 'income' | 'expense', amount: '', category: 'Iuran', description: '', date: `${initialMonth}-01`, dueTitle: '', dueAmount: '', dueDate: `${initialMonth}-28` });
  const [edit, setEdit] = useState({ type: 'income' as 'income' | 'expense', amount: '', category: '', description: '', date: '', reason: '' });
  const canManage = useMemo(() => hasCapability(position?.position ?? null, 'manage_cash'), [position]);

  const load = async () => {
    if (!active) return;
    setError('');
    try {
      const account = await (await import('../lib/repository')).getCashAccount(active);
      const [p, t, d, s] = await Promise.all([
        getClassPosition(active),
        listCashTransactionsByMonth(account.id, month),
        listCashDuesWithPayments(active, month),
        getCashMonthlySummary(active, month),
      ]);
      setPosition(p); setTx(t); setDues(d); setSummary(s);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat kas bulanan.'); }
  };

  useEffect(() => {
    void currentUserId().then(setMyUserId).catch(() => setMyUserId(null));
    listClasses().then(cs => {
      setClasses(cs);
      const preferred = cs.find(c => c.id === getActiveClassId())?.id || cs[0]?.id || '';
      if (preferred) { setActive(preferred); setActiveClassId(preferred); }
    }).catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat kelas.'));
  }, []);
  useEffect(() => { setForm(f => ({ ...f, date: `${month}-01`, dueDate: `${month}-28` })); void load(); }, [active, month]);

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Operasi kas gagal.'); } finally { setBusy(false); } };
  const addTx = () => run(async () => { await createCashTransaction(active, { type: form.type, amount: Number(form.amount), category: form.category, description: form.description, date: form.date }); setForm(f => ({ ...f, amount: '', description: '' })); });
  const addDue = () => run(async () => { await createCashDue(active, form.dueTitle, Number(form.dueAmount), form.dueDate || null); setForm(f => ({ ...f, dueTitle: '', dueAmount: '' })); });
  const pay = (d: CashDue) => run(async () => { await createCashPayment(d.id, Number(d.amount)); });
  const proof = async (paymentId: string) => { const file = proofs[paymentId]; if (!file) return; await run(async () => { await attachCashPaymentProof(paymentId, active, file); setProofs(p => { const n = { ...p }; delete n[paymentId]; return n; }); }); };
  const verify = (id: string, status: 'paid' | 'rejected' | 'partial') => run(async () => { await verifyCashPayment(id, status, status === 'rejected' ? 'Bukti tidak memenuhi verifikasi.' : undefined); });
  const voidTx = (t: CashTransaction) => run(async () => { const reason = await requestPrompt('Alasan membatalkan transaksi:', 'Kesalahan pencatatan', { title: 'Void transaksi', confirmLabel: 'Void transaksi' }); if (!reason) return; await voidCashTransaction(t.id, reason); });
  const startCorrection = (t: CashTransaction) => { setCorrection(t); setEdit({ type: t.transaction_type, amount: String(t.amount), category: t.category, description: t.description || '', date: t.transaction_date, reason: '' }); };
  const saveCorrection = () => { if (!correction) return; return run(async () => { await correctCashTransaction(correction.id, { type: edit.type, amount: Number(edit.amount), category: edit.category, description: edit.description, date: edit.date, reason: edit.reason }); setCorrection(null); }); };

  const paidCount = dues.reduce((n, d) => n + d.payments.filter(p => p.status === 'paid').length, 0);
  const pendingCount = dues.reduce((n, d) => n + d.payments.filter(p => p.status === 'pending').length, 0);
  const myDueStatus = (d: CashDue & { payments: CashPayment[] }) => {
    const mine = d.payments.filter(p => p.user_id === myUserId).sort((a, b) => String(b.paid_at || '').localeCompare(String(a.paid_at || '')));
    return mine[0]?.status;
  };

  const dueStats = useMemo(() => {
    let billed = 0, paid = 0, pending = 0, rejected = 0, partial = 0;
    dues.forEach(d => {
      billed += Number(d.amount || 0);
      const mine = d.payments.filter(p => p.user_id === myUserId).sort((a, b) => String(b.paid_at || '').localeCompare(String(a.paid_at || '')))[0];
      if (mine?.status === 'paid') paid += Number(mine.amount || 0);
      else if (mine?.status === 'pending') pending += Number(mine.amount || 0);
      else if (mine?.status === 'partial') partial += Number(mine.amount || 0);
      else if (mine?.status === 'rejected') rejected += Number(mine.amount || 0);
    });
    return { billed, paid, pending, partial, rejected, outstanding: Math.max(0, billed - paid) };
  }, [dues, myUserId]);

  return <div className="stack-page cash-monthly-page">
    <div className="mobile-page-head"><button className="mobile-back" onClick={() => { if (active) location.hash = `#/classes/${active}?tab=overview`; }} aria-label="Kembali">‹</button><div><h2>Kas Kelas</h2><small>Catatan keuangan per bulan</small></div></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}

    <Card className="cash-month-header"><div className="cash-month-top"><div><span className="eyebrow">Kelas aktif</span><strong>{classes.find(c => c.id === active)?.name || 'Pilih kelas'}</strong></div><select value={active} onChange={e => { setActive(e.target.value); setActiveClassId(e.target.value); }} aria-label="Pilih kelas">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="cash-month-switcher"><Button variant="ghost" disabled={busy} onClick={() => setMonth(shiftMonth(month, -1))}>‹</Button><label><span>Bulan kas</span><input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></label><Button variant="ghost" disabled={busy} onClick={() => setMonth(shiftMonth(month, 1))}>›</Button></div><div className="cash-month-label">{monthLabel(month)}</div></Card>

    <div className="cash-month-metrics">
      <Card className="cash-balance-card"><span className="metric-label">Saldo akhir {monthLabel(month)}</span><strong>{rupiah(summary.closing_balance)}</strong><small>Saldo awal + pemasukan − pengeluaran pada seluruh ledger sampai akhir periode.</small></Card>
      <Card><span className="metric-label">Saldo awal</span><strong>{rupiah(summary.opening_balance)}</strong><small>{monthLabel(month)}</small></Card>
      <Card><span className="metric-label">Pemasukan</span><strong className="income">+ {rupiah(summary.total_income)}</strong><small>{summary.transaction_count} transaksi dalam periode</small></Card>
      <Card><span className="metric-label">Pengeluaran</span><strong className="expense">- {rupiah(summary.total_expense)}</strong><small>Transaksi aktif bulan terpilih</small></Card>
    </div>
    <div className="cash-month-accounting-card"><span className="eyebrow">Ringkasan iuran</span><div className="cash-month-accounting-grid"><div><small>Total tagihan</small><strong>{rupiah(dueStats.billed)}</strong></div><div><small>Terbayar</small><strong className="income">{rupiah(dueStats.paid)}</strong></div><div><small>Menunggu</small><strong>{rupiah(dueStats.pending)}</strong></div><div><small>Belum lunas</small><strong className="expense">{rupiah(dueStats.outstanding)}</strong></div></div></div>

    <div className="cash-month-strip"><Button variant="ghost" disabled={busy} onClick={() => setMonth(shiftMonth(month, -1))}>‹</Button><button className="cash-month-pill" onClick={() => setMonth(initialMonth)} aria-label="Kembali ke bulan sekarang">{monthLabel(month)}</button><Button variant="ghost" disabled={busy} onClick={() => setMonth(shiftMonth(month, 1))}>›</Button><span className="cash-month-hint">Pilih bulan untuk melihat saldo, iuran, dan mutasi periode tersebut.</span></div>

    <Card className="my-dues-card"><div className="section-head"><div><span className="eyebrow">Iuran periode</span><h3>Iuran saya · {monthLabel(month)}</h3></div><Badge tone="info">{dues.length} tagihan</Badge></div><div className="cash-dues-summary"><span>✅ {paidCount} pembayaran lunas</span><span>⏳ {pendingCount} menunggu</span><span>✓ Pembayaran paid otomatis masuk ledger kas</span></div>{dues.length ? <div className="my-dues-list">{dues.map(d => { const status = myDueStatus(d); return <div className="my-due-row" key={d.id}><div><strong>{d.title}</strong><small>{rupiah(Number(d.amount))} · {d.due_date || 'Tanpa deadline'}</small></div><Badge tone={status === 'paid' ? 'good' : status === 'rejected' ? 'danger' : status === 'partial' ? 'warn' : status === 'pending' ? 'neutral' : 'warn'}>{status === 'paid' ? 'Lunas' : status === 'rejected' ? 'Ditolak' : status === 'partial' ? 'Parsial' : status === 'pending' ? 'Menunggu' : 'Belum bayar'}</Badge></div>; })}</div> : <Empty title={`Belum ada iuran untuk ${monthLabel(month)}`} body="Buat iuran pada periode ini agar pembayaran mudah dipantau." />}</Card>

    <div className="grid-2">
      {canManage && <Card><div className="section-head"><div><span className="eyebrow">Bendahara</span><h3>Tambah transaksi {monthLabel(month)}</h3></div><Badge tone="info">{summary.transaction_count} transaksi</Badge></div><div className="grid-form"><Field label="Jenis"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select></Field><Field label="Nominal"><input inputMode="numeric" type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field><Field label="Kategori"><input maxLength={120} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></Field><Field label="Tanggal"><input type="date" min={`${month}-01`} max={`${month}-${daysInMonth(month)}`} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field><div className="span-2"><Field label="Deskripsi"><textarea rows={2} maxLength={500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field></div><div className="form-actions"><Button disabled={busy || !form.amount || !form.category.trim()} onClick={() => void addTx()}>Simpan transaksi</Button></div></div></Card>}
      <Card><div className="section-head"><div><span className="eyebrow">Mutasi bulan</span><h3>Riwayat {monthLabel(month)}</h3></div><Badge tone="neutral">{summary.transaction_count}</Badge></div>{tx.length ? tx.map(t => <div className="transaction-row" key={t.id}><div><strong>{t.category}</strong><small>{t.transaction_date} · {t.description || 'Tanpa deskripsi'}{t.voided_at ? ' · VOID' : ''}</small></div><div className="button-row"><span className={t.transaction_type === 'income' ? 'income' : 'expense'}>{t.transaction_type === 'income' ? '+' : '-'} {rupiah(Number(t.amount))}</span>{canManage && !t.voided_at && <><Button variant="ghost" disabled={busy} onClick={() => startCorrection(t)}>Koreksi</Button><Button variant="danger" disabled={busy} onClick={() => void voidTx(t)}>Void</Button></>}</div></div>) : <Empty title={`Belum ada transaksi pada ${monthLabel(month)}`} />}</Card>
    </div>

    <Card><div className="section-head"><div><span className="eyebrow">Iuran bulan</span><h3>Kelola iuran {monthLabel(month)}</h3></div></div>{canManage && <div className="grid-form"><Field label="Nama iuran"><input maxLength={200} value={form.dueTitle} onChange={e => setForm({ ...form, dueTitle: e.target.value })} /></Field><Field label="Nominal"><input type="number" min="1" value={form.dueAmount} onChange={e => setForm({ ...form, dueAmount: e.target.value })} /></Field><Field label="Jatuh tempo"><input type="date" min={`${month}-01`} max={`${month}-${daysInMonth(month)}`} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></Field><div className="form-actions"><Button disabled={busy || !form.dueTitle.trim() || !form.dueAmount} onClick={() => void addDue()}>Buat iuran</Button></div></div>}{dues.length ? dues.map(d => <DueRow key={d.id} due={d} canManage={canManage} busy={busy} proofFile={proofs[d.payments.find(p => p.user_id)?.id || '']} onSelectProof={(id, f) => setProofs(p => ({ ...p, [id]: f }))} onUploadProof={proof} onPay={() => pay(d)} onVerify={verify} />) : <Empty title="Belum ada iuran" body={canManage ? 'Buat iuran pertama untuk periode ini.' : 'Belum ada iuran pada periode ini.'} />}</Card>

    {correction && <Card className="sticky-editor"><div className="section-head"><div><span className="eyebrow">Audit trail</span><h3>Koreksi transaksi</h3></div><Button variant="ghost" onClick={() => setCorrection(null)}>Tutup</Button></div><div className="grid-form"><Field label="Jenis"><select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value as 'income' | 'expense' })}><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select></Field><Field label="Nominal"><input type="number" min="1" value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value })} /></Field><Field label="Kategori"><input value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })} /></Field><Field label="Tanggal"><input type="date" min={`${month}-01`} max={`${month}-${daysInMonth(month)}`} value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} /></Field><div className="span-2"><Field label="Alasan koreksi" hint="Minimal 3 karakter."><textarea rows={2} value={edit.reason} onChange={e => setEdit({ ...edit, reason: e.target.value })} /></Field></div><div className="form-actions"><Button disabled={busy || edit.reason.trim().length < 3 || !edit.amount || !edit.category.trim()} onClick={() => void saveCorrection()}>Simpan koreksi</Button></div></div></Card>}
  </div>;
}

function DueRow({ due, canManage, busy, onSelectProof, onUploadProof, onPay, onVerify }: { due: CashDue & { payments: CashPayment[] }; canManage: boolean; busy: boolean; proofFile?: File; onSelectProof: (id: string, file: File) => void; onUploadProof: (id: string) => Promise<void>; onPay: () => void; onVerify: (id: string, status: 'paid' | 'rejected' | 'partial') => void }) {
  return <div className="due-row"><div><strong>{due.title}</strong><small>{rupiah(Number(due.amount))} · {due.due_date || 'Tanpa deadline'}</small></div><div className="stack-actions"><div className="button-row"><Badge tone="neutral">{due.payments.length} pembayaran</Badge><Button variant="soft" disabled={busy || due.payments.some(p => p.user_id && (p.status === 'pending' || p.status === 'paid'))} onClick={onPay}>Ajukan pembayaran</Button></div>{due.payments.map(p => <PaymentRow key={p.id} payment={p} canManage={canManage} busy={busy} onSelectProof={onSelectProof} onUploadProof={onUploadProof} onVerify={onVerify} />)}</div></div>;
}

function PaymentRow({ payment, canManage, busy, onSelectProof, onUploadProof, onVerify }: { payment: CashPayment; canManage: boolean; busy: boolean; onSelectProof: (id: string, file: File) => void; onUploadProof: (id: string) => Promise<void>; onVerify: (id: string, status: 'paid' | 'rejected' | 'partial') => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!payment.proof_file_id) return; let mounted = true; import('../lib/repository').then(({ getFileById, getFileUrl }) => getFileById(payment.proof_file_id!).then(f => f && getFileUrl(f)).then(u => { if (mounted) setUrl(u ?? null); }).catch(() => {})); return () => { mounted = false; }; }, [payment.proof_file_id]);
  return <div className="payment-row"><div><Badge tone={payment.status === 'paid' ? 'good' : payment.status === 'rejected' ? 'danger' : payment.status === 'partial' ? 'warn' : 'neutral'}>{payment.status}</Badge><span>{rupiah(Number(payment.amount))}</span>{payment.rejection_reason && <small>{payment.rejection_reason}</small>}{payment.cash_transaction_id && <small className="cash-ledger-linked">✓ Masuk kas</small>}{url && <a href={url} target="_blank" rel="noreferrer">Lihat bukti</a>}</div><div className="button-row">{!canManage && payment.status !== 'paid' && <><input aria-label="Bukti pembayaran" type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) onSelectProof(payment.id, f); }} /><Button variant="soft" disabled={busy} onClick={() => void onUploadProof(payment.id)}>Upload bukti</Button></>}{canManage && payment.status === 'pending' && <><Button variant="ghost" disabled={busy} onClick={() => onVerify(payment.id, 'paid')}>Terima</Button><Button variant="ghost" disabled={busy} onClick={() => onVerify(payment.id, 'partial')}>Parsial</Button><Button variant="danger" disabled={busy} onClick={() => onVerify(payment.id, 'rejected')}>Tolak</Button></>}</div></div>;
}
