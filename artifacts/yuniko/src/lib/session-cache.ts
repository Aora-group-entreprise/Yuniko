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
