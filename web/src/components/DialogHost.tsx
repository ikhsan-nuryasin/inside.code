import { useEffect, useRef, useState } from 'react';

type DialogRequest = {
  kind: 'confirm' | 'prompt';
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: boolean | string | null) => void;
};

const EVENT = 'student-hub-dialog';

export function requestConfirm(message: string, options?: { title?: string; confirmLabel?: string; cancelLabel?: string }) {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, {
      detail: {
        kind: 'confirm',
        title: options?.title ?? 'Konfirmasi',
        message,
        confirmLabel: options?.confirmLabel ?? 'Lanjutkan',
        cancelLabel: options?.cancelLabel ?? 'Batal',
        resolve,
      } satisfies Omit<DialogRequest, 'resolve'> & { resolve: (value: boolean) => void },
    }));
  });
}

export function requestPrompt(message: string, defaultValue = '', options?: { title?: string; confirmLabel?: string; cancelLabel?: string; placeholder?: string }) {
  return new Promise<string | null>((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, {
      detail: {
        kind: 'prompt',
        title: options?.title ?? 'Masukkan data',
        message,
        defaultValue,
        placeholder: options?.placeholder ?? '',
        confirmLabel: options?.confirmLabel ?? 'Simpan',
        cancelLabel: options?.cancelLabel ?? 'Batal',
        resolve,
      } satisfies Omit<DialogRequest, 'resolve'> & { resolve: (value: string | null) => void },
    }));
  });
}

export function DialogHost() {
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const queue = useRef<DialogRequest[]>([]);
  const currentRef = useRef<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<DialogRequest>).detail;
      if (!detail) return;
      if (currentRef.current) queue.current.push(detail);
      else {
        setCurrent(detail);
        setValue(detail.defaultValue ?? '');
      }
    };
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null);
      if (event.key === 'Enter' && current.kind === 'confirm') finish(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  const finish = (result: boolean | string | null) => {
    if (!current) return;
    current.resolve(result);
    const next = queue.current.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
    setValue(next?.defaultValue ?? '');
  };

  if (!current) return null;
  return (
    <div className="app-dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null); }}>
      <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="student-hub-dialog-title">
        <div className="app-dialog-head">
          <div><span className="eyebrow">Student Hub</span><h3 id="student-hub-dialog-title">{current.title}</h3></div>
          <button className="app-dialog-close" type="button" onClick={() => finish(null)} aria-label="Tutup">×</button>
        </div>
        <p className="app-dialog-message">{current.message}</p>
        {current.kind === 'prompt' && <input autoFocus className="app-dialog-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={current.placeholder} />}
        <div className="app-dialog-actions">
          <button className="btn btn-ghost" type="button" onClick={() => finish(null)}>{current.cancelLabel ?? 'Batal'}</button>
          <button className="btn btn-primary" type="button" onClick={() => finish(current.kind === 'confirm' ? true : value.trim())}>{current.confirmLabel ?? 'Lanjutkan'}</button>
        </div>
      </section>
    </div>
  );
}
