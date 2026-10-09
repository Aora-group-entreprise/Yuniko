import { apiJson } from "@/lib/api";

type LikeAction = { id: string; userId: number; type: "like"; postId: number; liked: boolean; queuedAt: number };
type CommentAction = { id: string; userId: number; type: "comment"; postId: number; text: string; clientMutationId: string; queuedAt: number };
type PendingAction = LikeAction | CommentAction;
type BatchResult = {
  id: string; ok: boolean; retryable?: boolean; error?: string; type?: "like" | "comment";
  postId?: number; liked?: boolean; likes?: number; clientMutationId?: string;
  comments?: number; comment?: Record<string, unknown>;
};
const STORAGE_PREFIX = "yuniko_pending_interactions_v1_";
const BATCH_SIZE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
let activeUserId: number | null = null;
let timer: number | null = null;
let flushing = false;
let listenersAttached = false;

function makeId(): string {
  try { return crypto.randomUUID(); }
  catch { return `ym_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`; }
}
function storageKey(userId: number): string { return STORAGE_PREFIX + userId; }
function readQueue(userId: number): PendingAction[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingAction => item && Number(item.userId) === userId &&
      (item.type === "like" || item.type === "comment") && typeof item.id === "string" &&
      Number.isSafeInteger(Number(item.postId)) && Number(item.postId) > 0);
  } catch { return []; }
}
function writeQueue(userId: number, queue: PendingAction[]): void {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(queue)); } catch {}
}
function scheduleFlush(delayOverride?: number): void {
  if (typeof window === "undefined" || activeUserId === null) return;
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  const queue = readQueue(activeUserId);
  if (!queue.length) return;
  const nextDueAt = Math.min(...queue.map(action => action.queuedAt + DAY_MS));
  const delay = delayOverride ?? Math.max(0, nextDueAt - Date.now());
  timer = window.setTimeout(() => {
    timer = null;
    if (activeUserId !== null) void flushInteractionQueue(activeUserId);
  }, delay);
}
function emit(name: string, detail: Record<string, unknown>): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}
function attachListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("online", () => { if (activeUserId !== null) scheduleFlush(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && activeUserId !== null) scheduleFlush();
  });
}
export function configureInteractionQueue(userId: number): () => void {
  activeUserId = Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  attachListeners();
  if (activeUserId !== null) scheduleFlush();
  return () => {
    if (activeUserId !== userId) return;
    activeUserId = null;
    if (timer !== null && typeof window !== "undefined") window.clearTimeout(timer);
    timer = null;
  };
}
export function enqueueLike(userId: number, postId: number, liked: boolean): string {
  const id = makeId();
  const queue = readQueue(userId).filter(action => !(action.type === "like" && action.postId === postId));
  queue.push({ id, userId, type: "like", postId, liked, queuedAt: Date.now() });
  writeQueue(userId, queue.slice(-1000));
  scheduleFlush();
  return id;
}
export function enqueueComment(userId: number, postId: number, text: string): string {
  const id = makeId();
  const queue = readQueue(userId);
  queue.push({ id, userId, type: "comment", postId, text, clientMutationId: id, queuedAt: Date.now() });
  writeQueue(userId, queue.slice(-1000));
  scheduleFlush();
  return id;
}
export function getPendingComments(postId: number): Array<{ id: string; clientMutationId: string; text: string; queuedAt: number }> {
  if (activeUserId === null) return [];
  return readQueue(activeUserId).filter((action): action is CommentAction => action.type === "comment" && action.postId === postId)
    .map(action => ({ id: action.id, clientMutationId: action.clientMutationId, text: action.text, queuedAt: action.queuedAt }));
}
export function getPendingLike(postId: number): { id: string; liked: boolean } | null {
  if (activeUserId === null) return null;
  const action = readQueue(activeUserId).find((item): item is LikeAction => item.type === "like" && item.postId === postId);
  return action ? { id: action.id, liked: action.liked } : null;
}
export async function flushInteractionQueue(userId: number): Promise<void> {
  if (flushing || activeUserId !== userId || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const queue = readQueue(userId);
  if (!queue.length) return;
  const dueQueue = queue.filter(action => action.queuedAt + DAY_MS <= Date.now());
  if (!dueQueue.length) { scheduleFlush(); return; }
  const batch = dueQueue.slice(0, BATCH_SIZE);
  flushing = true;
  try {
    const response = await apiJson<{ results: BatchResult[] }>("/posts/interactions/batch", {
      method: "POST",
      body: JSON.stringify({ actions: batch.map(action => action.type === "like"
        ? { id: action.id, type: action.type, postId: action.postId, liked: action.liked }
        : { id: action.id, type: action.type, postId: action.postId, text: action.text, clientMutationId: action.clientMutationId }) }),
    });
    const results = Array.isArray(response.results) ? response.results : [];
    const byId = new Map(results.map(result => [result.id, result]));
    const remove = new Set<string>();
    for (const action of batch) {
      const result = byId.get(action.id);
      if (!result) continue;
      if (result.ok) {
        remove.add(action.id);
        if (action.type === "like") emit("yuniko:interaction-ack", {
          id: action.id, type: "like", postId: action.postId, liked: result.liked, likes: result.likes,
        });
        else emit("yuniko:interaction-ack", {
          id: action.id, type: "comment", postId: action.postId, clientMutationId: action.clientMutationId,
          comment: result.comment, comments: result.comments,
        });
      } else if (result.retryable === false) {
        remove.add(action.id);
        if (action.type === "comment") emit("yuniko:interaction-failed", {
          id: action.id, type: "comment", postId: action.postId, clientMutationId: action.clientMutationId,
          error: result.error,
        });
      }
    }
    writeQueue(userId, readQueue(userId).filter(action => !remove.has(action.id)));
    if (readQueue(userId).length) scheduleFlush(remove.size ? 100 : 10000);
  } catch (error) {
    console.warn("[YUNIKO BATCH] interactions remain queued for retry", error);
    scheduleFlush(10000);
  } finally {
    flushing = false;
  }
}
