const CACHE_PREFIX = "yuniko_api_cache_v1_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DB_NAME = "yuniko-cache";
const DB_STORE = "api-responses";
type Entry = { savedAt: number; path: string; value: unknown };
const memory = new Map<string, Entry>();
let activeUserId: number | null = null;
let databasePromise: Promise<IDBDatabase | null> | null = null;

function isFresh(entry: Entry | null | undefined): entry is Entry {
  return Boolean(entry && typeof entry.savedAt === "number" && Date.now() - entry.savedAt >= 0 && Date.now() - entry.savedAt < CACHE_TTL_MS);
}
function cacheKey(userId: number, path: string) { return `${userId}:${path}`; }
function localKey(userId: number, path: string) {
  let encoded = "";
  try { encoded = btoa(unescape(encodeURIComponent(path))).replace(/[^a-zA-Z0-9_-]/g, ""); }
  catch { encoded = String(path.length) + "_" + path.slice(0, 80).replace(/[^a-zA-Z0-9_-]/g, "_"); }
  return CACHE_PREFIX + userId + "_" + encoded;
}
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return databasePromise;
}
async function idbGet(key: string): Promise<Entry | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(isFresh(req.result) ? req.result : null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch { db.close(); resolve(null); }
  });
}
async function idbPut(key: string, entry: Entry): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(entry, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    } catch { db.close(); resolve(); }
  });
}
export function setApiCacheUser(userId: number | null): void {
  activeUserId = Number.isInteger(userId) && Number(userId) > 0 ? Number(userId) : null;
  memory.clear();
}
export async function getApiCached<T>(path: string): Promise<T | undefined> {
  const userId = activeUserId;
  if (userId === null || typeof window === "undefined") return undefined;
  const key = cacheKey(userId, path);
  const inMemory = memory.get(key);
  if (isFresh(inMemory)) return inMemory.value as T;
  if (inMemory) memory.delete(key);
  try {
    const raw = localStorage.getItem(localKey(userId, path));
    if (raw) {
      const parsed = JSON.parse(raw) as Entry;
      if (isFresh(parsed)) {
        memory.set(key, parsed);
        return parsed.value as T;
      }
      localStorage.removeItem(localKey(userId, path));
    }
  } catch {}
  const persisted = await idbGet(key);
  if (!persisted || activeUserId !== userId) return undefined;
  memory.set(key, persisted);
  try { localStorage.setItem(localKey(userId, path), JSON.stringify(persisted)); } catch {}
  return persisted.value as T;
}
export function setApiCached(path: string, value: unknown): void {
  const userId = activeUserId;
  if (userId === null || typeof window === "undefined") return;
  const key = cacheKey(userId, path);
  const entry: Entry = { savedAt: Date.now(), path, value };
  memory.set(key, entry);
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length <= 200_000) localStorage.setItem(localKey(userId, path), serialized);
  } catch {}
  void idbPut(key, entry);
}
export function invalidateApiCache(path: string): void {
  const userId = activeUserId;
  if (userId === null || typeof window === "undefined") return;
  const key = cacheKey(userId, path);
  memory.delete(key);
  try { localStorage.removeItem(localKey(userId, path)); } catch {}
  void openDb().then(db => {
    if (!db) return;
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch { db.close(); }
  });
}
export function invalidateApiCachePrefix(prefix: string): void {
  const userId = activeUserId;
  if (userId === null || typeof window === "undefined") return;
  const start = cacheKey(userId, prefix);
  for (const [key, entry] of memory.entries()) {
    if (key.startsWith(start) || entry.path.startsWith(prefix)) memory.delete(key);
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX + userId + "_")) continue;
      try {
        const raw = localStorage.getItem(key);
        const entry = raw ? JSON.parse(raw) as Entry : null;
        if (entry && typeof entry.path === "string" && entry.path.startsWith(prefix)) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  } catch {}
  void openDb().then(db => {
    if (!db) return;
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.key);
        const entry = cursor.value as Entry;
        if (key.startsWith(start) || entry?.path?.startsWith(prefix)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch { db.close(); }
  });
}
export function clearApiCacheForUser(userId: number): void {
  if (activeUserId === userId) memory.clear();
}
export function isCacheableGet(path: string): boolean {
  const clean = path.startsWith("/") ? path : "/" + path;
  if (/^\/auth\/(?:me|login|logout|register|reset-password|change-password|delete-account)/i.test(clean)) return false;
  if (/^\/realtime\//i.test(clean) || /^\/posts\/feed\/updates/i.test(clean)) return false;
  if (/^\/stories\/\d+\/views/i.test(clean)) return false;
  if (/^\/messages\/conversations\/\d+\?after=/i.test(clean)) return false;
  return true;
}
