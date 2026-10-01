import type { SyncQueueItem } from '../types/models';

const DB_NAME = 'inside-code-pwa';
const VERSION = 2;
type StoreName = 'cache' | 'queue' | 'meta' | 'files';

export interface LocalFileRecord {
  key: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('inside-code-sync') : null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB error'));
  }).catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

async function transact<T>(store: StoreName, mode: IDBTransactionMode, work: (objectStore: IDBObjectStore, tx: IDBTransaction) => IDBRequest | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = work(tx.objectStore(store), tx) as IDBRequest | undefined;
    let result: unknown;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction error'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function put(store: StoreName, value: unknown): Promise<void> {
  await transact(store, 'readwrite', os => os.put(value));
}
async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  return transact<T | undefined>(store, 'readonly', os => os.get(key));
}
async function all<T>(store: StoreName): Promise<T[]> {
  return transact<T[]>(store, 'readonly', os => os.getAll());
}

export async function cacheSet<T>(key: string, value: T) { await put('cache', { key, value, updatedAt: Date.now() }); }
export async function cacheGet<T>(key: string) { const row = await get<{ value: T }>('cache', key); return row?.value; }

export async function cacheRemoveByPrefixes(prefixes: string[]) {
  const normalized = prefixes.filter(Boolean);
  if (!normalized.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const req = store.getAllKeys();
    req.onsuccess = () => {
      for (const raw of req.result) {
        const key = String(raw);
        if (normalized.some(prefix => key.startsWith(prefix))) store.delete(raw);
      }
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB cache key listing error'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB cache prefix delete error'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB cache prefix delete aborted'));
  });
}

export async function cacheRemove(key: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB cache delete error'));
  });
}

export async function cacheClear() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB cache clear error'));
  });
}

export async function metaSet<T>(key: string, value: T) { await put('meta', { key, value }); }
export async function metaGet<T>(key: string) { const row = await get<{ value: T }>('meta', key); return row?.value; }

export async function queuePush(item: SyncQueueItem) {
  await put('queue', item);
  syncChannel?.postMessage({ type: 'queue-changed' });
}
export async function queueAll() { return (await all<SyncQueueItem>('queue')).sort((a, b) => a.createdAt - b.createdAt); }
export async function queueRetry(operationId: string) {
  const current = await queueAll();
  const item = current.find(x => x.operationId === operationId);
  if (!item) return;
  await queuePush({ ...item, status: 'pending', attempts: 0, lastError: '', updatedAt: Date.now() });
  broadcastSyncEvent();
}

export async function queueRemove(operationId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(operationId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete error'));
  });
  syncChannel?.postMessage({ type: 'queue-changed' });
}

export async function localFileSet(record: LocalFileRecord) { await put('files', record); }
export async function localFileGet(key: string) { return get<LocalFileRecord>('files', key); }
export async function localFileList() { return all<LocalFileRecord>('files'); }
export async function localFileRemove(key: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB file delete error'));
  });
}

export function broadcastSyncEvent() { syncChannel?.postMessage({ type: 'sync' }); }
export function subscribeSyncEvents(listener: () => void) {
  if (!syncChannel) return () => {};
  const handler = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === 'sync' || event.data?.type === 'queue-changed') listener();
  };
  syncChannel.addEventListener('message', handler);
  return () => syncChannel.removeEventListener('message', handler);
}

export async function clearLocalData() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['cache', 'queue', 'meta', 'files'], 'readwrite');
    tx.objectStore('cache').clear();
    tx.objectStore('queue').clear();
    tx.objectStore('meta').clear();
    tx.objectStore('files').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB clear error'));
  });
  syncChannel?.postMessage({ type: 'queue-changed' });
}
