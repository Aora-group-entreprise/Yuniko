import { apiJson } from "@/lib/api";

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
const CACHE_PREFIX = "yuniko_data_cache_v1_";
// Keep the persistent cache below typical browser localStorage quotas.
const MAX_PERSISTED_CACHE_CHARS = 3_000_000;
let activeUserId: number | null = null;
let generation = 0;

function storageKey(userId: number): string {
  return CACHE_PREFIX + userId;
}

function persistCache(): void {
  if (activeUserId === null || typeof window === "undefined") return;
  try {
    const entries = Object.fromEntries(cache.entries());
    const serialized = JSON.stringify(entries);
    if (serialized.length > MAX_PERSISTED_CACHE_CHARS) return;
    localStorage.setItem(storageKey(activeUserId), serialized);
  } catch {
    // Cache persistence is best-effort; app functionality must not depend on it.
  }
}

function restoreCache(userId: number): void {
  cache.clear();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return;
    const entries = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(entries)) cache.set(key, value);
  } catch {
    try { localStorage.removeItem(storageKey(userId)); } catch {}
  }
}

export function setSessionUser(userId: number): void {
  if (!Number.isInteger(userId) || userId <= 0) return;
  if (activeUserId === userId) return;
  activeUserId = userId;
  generation += 1;
  pending.clear();
  restoreCache(userId);
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
