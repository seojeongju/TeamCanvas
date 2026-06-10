const DB_NAME = "teamcanvas-offline";
const DB_VERSION = 1;
const CACHE_STORE = "cache";
const QUEUE_STORE = "queue";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function txStore(store: string, mode: IDBTransactionMode) {
  return openDb().then(
    (db) => db.transaction(store, mode).objectStore(store),
  );
}

export async function idbGet<T>(key: string, store = CACHE_STORE): Promise<T | null> {
  try {
    const objectStore = await txStore(store, "readonly");
    return new Promise((resolve, reject) => {
      const req = objectStore.get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T, store = CACHE_STORE): Promise<void> {
  try {
    const objectStore = await txStore(store, "readwrite");
    await new Promise<void>((resolve, reject) => {
      const req = objectStore.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* quota / private mode */
  }
}

export async function idbDelete(key: string, store = CACHE_STORE): Promise<void> {
  try {
    const objectStore = await txStore(store, "readwrite");
    await new Promise<void>((resolve, reject) => {
      const req = objectStore.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore */
  }
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  try {
    const objectStore = await txStore(store, "readonly");
    return new Promise((resolve, reject) => {
      const req = objectStore.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export const IDB_STORES = { CACHE_STORE, QUEUE_STORE } as const;
