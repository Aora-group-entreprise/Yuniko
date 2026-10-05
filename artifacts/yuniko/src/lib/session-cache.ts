import { apiJson } from "@/lib/api";

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
let activeUserId: number | null = null;
let generation = 0;

export function setSessionUser(userId: number): void {
  if (!Number.isInteger(userId) || userId <= 0) return;
  if (activeUserId === userId) return;
  activeUserId = userId;
  generation += 1;
  cache.clear();
  pending.clear();
}

export function getSessionCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function hasSessionCache(key: string): boolean {
  return cache.has(key);
}

export function invalidateSessionCache(key: string): void {
  cache.delete(key);
}

export async function fetchSessionJson<T>(path: string): Promise<T> {
  const cached = getSessionCache<T>(path);
  if (cached !== undefined) return cached;
  const existing = pending.get(path);
  if (existing) return existing as Promise<T>;
  const requestGeneration = generation;
  const request = apiJson<T>(path)
    .then((data) => {
      if (requestGeneration === generation) cache.set(path, data);
      return data;
    })
    .finally(() => pending.delete(path));
  pending.set(path, request);
  return request;
}

export function warmSessionData(userId: number): void {
  const warm = () => {
    void fetchSessionJson(`/users/${userId}`).catch(() => {});
    void fetchSessionJson("/messages/conversations").catch(() => {});
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    }).requestIdleCallback?.(warm, { timeout: 1200 });
  } else {
    window.setTimeout(warm, 250);
  }
}
