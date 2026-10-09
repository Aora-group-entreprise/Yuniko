import { apiJson } from "@/lib/api";

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
const CACHE_PREFIX = "yuniko_data_cache_v2_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LOCAL_STORAGE_CHARS = 3_000_000;
const DB_NAME = "yuniko-cache";
const DB_STORE = "sessions";
let activeUserId: number | null = null;
let generation = 0;
let hydration: Promise<void> = Promise.resolve();

type PersistedCache = {
  version: 2;
  savedAt: number;
  entries: Record<string, unknown>;
};

function storageKey(userId: number): string {
  return CACHE_PREFIX + userId;
}

function isFresh(savedAt: unknown): savedAt is number {
  return typeof savedAt === "number" && Date.now() - savedAt >= 0 && Date.now() - savedAt < CACHE_TTL_MS;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIndexedDb(userId: number): Promise<PersistedCache | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(String(userId));
      request.onsuccess = () => {
        const value = request.result as PersistedCache | undefined;
        resolve(value?.version === 2 && isFresh(value.savedAt) ? value : null);
      };
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeIndexedDb(userId: number, value: PersistedCache): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, String(userId));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    } catch {
      db.close();
      resolve();
    }
  });
}

function applyPersisted(value: PersistedCache): void {
  cache.clear();
  for (const [key, item] of Object.entries(value.entries)) cache.set(key, item);
}

function readLocalStorage(userId: number): PersistedCache | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as PersistedCache;
    if (value?.version !== 2 || !isFresh(value.savedAt) || !value.entries || typeof value.entries !== "object") {
      localStorage.removeItem(storageKey(userId));
      return null;
    }
    return value;
  } catch {
    try { localStorage.removeItem(storageKey(userId)); } catch {}
    return null;
  }
}

function persistCache(): void {
  const userId = activeUserId;
  if (userId === null || typeof window === "undefined") return;
  const value: PersistedCache = {
    version: 2,
    savedAt: Date.now(),
    entries: Object.fromEntries(cache.entries()),
  };
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_LOCAL_STORAGE_CHARS) {
      localStorage.setItem(storageKey(userId), serialized);
    } else {
      // IndexedDB can retain larger snapshots when localStorage quota is reached.
      try { localStorage.removeItem(storageKey(userId)); } catch {}
    }
  } catch {
    // IndexedDB below is the best-effort fallback.
  }
  void writeIndexedDb(userId, value);
}

function restoreCache(userId: number): Promise<void> {
  cache.clear();
  const local = readLocalStorage(userId);
  if (local) applyPersisted(local);
  return readIndexedDb(userId).then((indexed) => {
    if (activeUserId !== userId || !indexed) return;
    // Prefer the newest complete snapshot without replacing a newer local write.
    const localSavedAt = local?.savedAt ?? 0;
    if (indexed.savedAt > localSavedAt) applyPersisted(indexed);
  }).catch(() => {});
}

export function setSessionUser(userId: number): void {
  if (!Number.isInteger(userId) || userId <= 0) return;
  if (activeUserId === userId) return;
  activeUserId = userId;
  generation += 1;
  pending.clear();
  hydration = restoreCache(userId);
}

export function getSessionCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function hasSessionCache(key: string): boolean {
  return cache.has(key);
}

export function invalidateSessionCache(key: string): void {
  cache.delete(key);
  persistCache();
}

export async function fetchSessionJson<T>(path: string): Promise<T> {
  await hydration;
  const cached = getSessionCache<T>(path);
  if (cached !== undefined) return cached;
  const existing = pending.get(path);
  if (existing) return existing as Promise<T>;
  const requestGeneration = generation;
  const request = apiJson<T>(path)
    .then((data) => {
      if (requestGeneration === generation) {
        cache.set(path, data);
        persistCache();
      }
      return data;
    })
    .finally(() => {
      if (pending.get(path) === request) pending.delete(path);
    });
  pending.set(path, request);
  return request;
}

export function warmSessionData(userId: number): void {
  const warm = [
    "/stories",
    "/messages/conversations",
    `/users/${userId}`,
    "/posts/mine",
    "/posts/saved",
    "/notifications",
    "/settings",
  ];
  for (const path of warm) void fetchSessionJson(path).catch(() => {});

  void fetchSessionJson<{ conversations?: Array<{ user?: { id?: number } }> }>(
    "/messages/conversations",
  ).then((data) => {
    for (const conversation of (data.conversations ?? []).slice(0, 6)) {
      const id = conversation.user?.id;
      if (Number.isInteger(id) && Number(id) > 0) {
        void fetchSessionJson(`/messages/conversations/${id}`).catch(() => {});
      }
    }
  }).catch(() => {});
}
