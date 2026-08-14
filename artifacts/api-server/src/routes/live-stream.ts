import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { liveSessionsTable, liveEngagementsTable, liveCommentsTable, usersTable } from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { assertLiveEnabled, assertSfuEnabled, getVideoFeatureConfig } from "../infrastructure/video-features";
import { getSfuConfig } from "../infrastructure/media-sfu";
import { getLiveRecorder } from "../infrastructure/live-recording";

const router = Router();
type R = Request & { userId?: number };
type Signal = { type: "join" | "offer" | "answer" | "candidate" | "leave" | "end"; from: string; to?: string; data?: unknown };
type Peer = { userId: number; responses: Set<Response> };
const livePeers = new Map<number, Map<string, Peer>>();

function send(peer: Peer, message: Signal) { for (const res of peer.responses) { try { res.write(`event: signal\ndata: ${JSON.stringify(message)}\n\n`); } catch {} } }
function broadcast(sessionId: number, message: Signal, except?: string) { const peers = livePeers.get(sessionId); if (!peers) return; for (const [id, peer] of peers) if (id !== except) send(peer, message); }
function ensureSessionPeers(sessionId: number) { let peers = livePeers.get(sessionId); if (!peers) { peers = new Map(); livePeers.set(sessionId, peers); } return peers; }
async function activeLive(id: number) { const [live] = await db.select().from(liveSessionsTable).where(and(eq(liveSessionsTable.id, id), eq(liveSessionsTable.status, "live"))).limit(1); return live; }
function requireLive(res: Response) { try { assertLiveEnabled(); return true; } catch (e) { const error = e as Error & { statusCode?: number }; res.status(error.statusCode ?? 403).json({ error: error.message }); return false; } }

router.post("/live", authMiddleware, async (req: R, res) => {
  if (!requireLive(res)) return;
  try {
    const [session] = await db.insert(liveSessionsTable).values({ hostUserId: req.userId!, title: String(req.body?.title ?? "").trim(), streamUrl: null, isPublic: true }).returning();
    ensureSessionPeers(session.id);
    return res.status(201).json({ live: session, transport: getSfuConfig().enabled ? "sfu" : "webrtc-direct" });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); }
});

router.get("/live", authMiddleware, async (_req: R, res) => {
  if (!requireLive(res)) return;
  try {
    const lives = await db.select({ id: liveSessionsTable.id, hostUserId: liveSessionsTable.hostUserId, title: liveSessionsTable.title, streamUrl: liveSessionsTable.streamUrl, status: liveSessionsTable.status, startedAt: liveSessionsTable.startedAt, hostUsername: usersTable.username, hostDisplayName: usersTable.displayName, hostAvatar: usersTable.avatarUrl }).from(liveSessionsTable).innerJoin(usersTable, eq(usersTable.id, liveSessionsTable.hostUserId)).where(and(eq(liveSessionsTable.status, "live"), eq(liveSessionsTable.isPublic, true))).orderBy(desc(liveSessionsTable.startedAt)).limit(100);
    return res.json({ lives });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); }
});

router.post("/live/:id/join", authMiddleware, async (req: R, res) => {
  if (!requireLive(res)) return;
  const sessionId = Number(req.params.id); const peerId = String(req.body?.peerId ?? "").trim();
  if (!Number.isInteger(sessionId) || !peerId) return res.status(400).json({ error: "Invalid live or peer" });
  const live = await activeLive(sessionId); if (!live) return res.status(404).json({ error: "Live not found" });
  const peers = ensureSessionPeers(sessionId); const existing = [...peers.entries()].map(([id, p]) => ({ id, userId: p.userId }));
  const peer = peers.get(peerId) ?? { userId: req.userId!, responses: new Set<Response>() }; peer.userId = req.userId!; peers.set(peerId, peer);
  broadcast(sessionId, { type: "join", from: peerId, data: { userId: req.userId } }, peerId);
  return res.json({ joined: true, peers: existing.filter(p => p.id !== peerId), transport: getSfuConfig().enabled ? "sfu" : "webrtc-direct" });
});

router.get("/live/:id/signals", authMiddleware, async (req: R, res) => {
  if (!requireLive(res)) return;
  const sessionId = Number(req.params.id); const peerId = String(req.query.peerId ?? "").trim();
  if (!Number.isInteger(sessionId) || !peerId) return res.status(400).end();
  if (!await activeLive(sessionId)) return res.status(404).end();
  const peers = ensureSessionPeers(sessionId); const peer = peers.get(peerId) ?? { userId: req.userId!, responses: new Set<Response>() }; peer.userId = req.userId!; peers.set(peerId, peer);
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.setHeader("Connection", "keep-alive"); res.flushHeaders?.(); peer.responses.add(res); res.write(`event: ready\ndata: ${JSON.stringify({ peerId })}\n\n`);
  const keepAlive = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 15000);
  req.on("close", () => { clearInterval(keepAlive); peer.responses.delete(res); if (peer.responses.size === 0 && peers.has(peerId)) { peers.delete(peerId); broadcast(sessionId, { type: "leave", from: peerId }, peerId); void cleanupOrphanedLive(sessionId); } if (peers.size === 0) livePeers.delete(sessionId); });
});

async function cleanupOrphanedLive(sessionId: number) {
  try {
    const [live] = await db.select({ id: liveSessionsTable.id, hostUserId: liveSessionsTable.hostUserId }).from(liveSessionsTable).where(eq(liveSessionsTable.id, sessionId));
    if (!live) return;
    const peers = livePeers.get(sessionId);
    const hostStillConnected = [...(peers?.values() ?? [])].some(p => p.userId === live.hostUserId);
    if (!hostStillConnected) {
      await db.delete(liveSessionsTable).where(and(eq(liveSessionsTable.id, sessionId), eq(liveSessionsTable.hostUserId, live.hostUserId)));
      for (const p of peers?.values() ?? []) for (const response of p.responses) { try { response.write(`event: signal\ndata: ${JSON.stringify({ type: "end", from: `host:${live.hostUserId}` })}\n\n`); } catch {} }
      livePeers.delete(sessionId);
    }
  } catch (e) { console.error("Live orphan cleanup failed", e); }
}

router.post("/live/:id/signal", authMiddleware, async (req: R, res) => {
  if (!requireLive(res)) return;
  const sessionId = Number(req.params.id); const from = String(req.body?.from ?? "").trim(); const to = req.body?.to ? String(req.body.to) : undefined; const type = req.body?.type as Signal["type"];
  if (!Number.isInteger(sessionId) || !from || !["offer", "answer", "candidate", "leave"].includes(type)) return res.status(400).json({ error: "Invalid signal" });
  if (!await activeLive(sessionId)) return res.status(404).json({ error: "Live not active" });
  const peers = livePeers.get(sessionId); if (!peers) return res.status(404).json({ error: "Live not active" });
  const sender = peers.get(from); if (!sender || sender.userId !== req.userId) return res.status(403).json({ error: "Peer not owned by user" });
  const message: Signal = { type, from, to, data: req.body?.data }; if (to) { const target = peers.get(to); if (target) send(target, message); } else broadcast(sessionId, message, from); return res.json({ delivered: true });
});

router.get("/live/:id/sfu", authMiddleware, async (req: R, res) => {
  if (!requireLive(res)) return;
  try {
    const liveId = Number(req.params.id); if (!Number.isInteger(liveId) || !await activeLive(liveId)) return res.status(404).json({ error: "Live not found" });
    assertSfuEnabled();
    const config = getSfuConfig();
    if (!config.enabled) return res.status(503).json({ error: "SFU is not configured" });
    return res.json({ enabled: true, url: config.url, scope: "world", multiViewer: true });
  } catch (e) { const error = e as Error & { statusCode?: number }; return res.status(error.statusCode ?? 503).json({ error: error.message }); }
});

router.get("/live/:id/engagements", authMiddleware, async (req: R, res) => { if (!requireLive(res)) return; const liveId = Number(req.params.id); try { if (!await activeLive(liveId)) return res.status(404).json({ error: "Live not found" }); const [counts] = await db.select({ likes: sql<number>`coalesce(sum(case when ${liveEngagementsTable.liked} then 1 else 0 end),0)`, shares: sql<number>`coalesce(sum(case when ${liveEngagementsTable.shared} then 1 else 0 end),0)` }).from(liveEngagementsTable).where(eq(liveEngagementsTable.liveId, liveId)); const [mine] = await db.select({ liked: liveEngagementsTable.liked, shared: liveEngagementsTable.shared }).from(liveEngagementsTable).where(and(eq(liveEngagementsTable.liveId, liveId), eq(liveEngagementsTable.userId, req.userId!))).limit(1); const comments = await db.select({ id: liveCommentsTable.id, text: liveCommentsTable.text, createdAt: liveCommentsTable.createdAt, userId: liveCommentsTable.userId, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl }).from(liveCommentsTable).innerJoin(usersTable, eq(usersTable.id, liveCommentsTable.userId)).where(eq(liveCommentsTable.liveId, liveId)).orderBy(desc(liveCommentsTable.createdAt)).limit(100); return res.json({ likes: Number(counts?.likes ?? 0), shares: Number(counts?.shares ?? 0), liked: Boolean(mine?.liked), shared: Boolean(mine?.shared), comments }); } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); } });

async function toggleEngagement(liveId: number, userId: number, field: "liked" | "shared") { const [existing] = await db.select().from(liveEngagementsTable).where(and(eq(liveEngagementsTable.liveId, liveId), eq(liveEngagementsTable.userId, userId))).limit(1); if (!existing) { const [row] = await db.insert(liveEngagementsTable).values({ liveId, userId, [field]: true }).returning(); return { active: true, row }; } const active = !existing[field]; const [row] = await db.update(liveEngagementsTable).set({ [field]: active, updatedAt: new Date() }).where(eq(liveEngagementsTable.id, existing.id)).returning(); return { active, row }; }

router.post("/live/:id/like", authMiddleware, async (req: R, res) => { if (!requireLive(res)) return; const liveId = Number(req.params.id); try { if (!await activeLive(liveId)) return res.status(404).json({ error: "Live not found" }); const result = await toggleEngagement(liveId, req.userId!, "liked"); return res.json({ active: result.active }); } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); } });
router.post("/live/:id/share", authMiddleware, async (req: R, res) => { if (!requireLive(res)) return; const liveId = Number(req.params.id); try { if (!await activeLive(liveId)) return res.status(404).json({ error: "Live not found" }); const result = await toggleEngagement(liveId, req.userId!, "shared"); return res.json({ active: result.active }); } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); } });
router.post("/live/:id/comments", authMiddleware, async (req: R, res) => { if (!requireLive(res)) return; const liveId = Number(req.params.id); const text = String(req.body?.text ?? "").trim(); if (!text) return res.status(400).json({ error: "Comment text required" }); if (text.length > 500) return res.status(400).json({ error: "Comment too long" }); try { if (!await activeLive(liveId)) return res.status(404).json({ error: "Live not found" }); const [comment] = await db.insert(liveCommentsTable).values({ liveId, userId: req.userId!, text }).returning(); const [author] = await db.select({ username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1); return res.status(201).json({ comment: { ...comment, ...author } }); } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); } });

router.patch("/live/:id/end", authMiddleware, async (req: R, res) => {
  if (!requireLive(res)) return;
  try {
    const sessionId = Number(req.params.id); const [live] = await db.select().from(liveSessionsTable).where(and(eq(liveSessionsTable.id, sessionId), eq(liveSessionsTable.hostUserId, req.userId!))).limit(1);
    if (!live) return res.status(404).json({ error: "Live not found" });
    const recording = await getLiveRecorder().stop({ liveId: sessionId });
    await db.delete(liveSessionsTable).where(and(eq(liveSessionsTable.id, sessionId), eq(liveSessionsTable.hostUserId, req.userId!)));
    broadcast(sessionId, { type: "end", from: `host:${req.userId}` });
    for (const peer of livePeers.get(sessionId)?.values() ?? []) for (const response of peer.responses) { try { response.end(); } catch {} }
    livePeers.delete(sessionId);
    return res.json({ live: { ...live, status: "ended", endedAt: new Date() }, recording: recording ?? null });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Server error" }); }
});

router.get("/live/:id/stream", authMiddleware, async (req: R, res) => { if (!requireLive(res)) return; res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.setHeader("Connection", "keep-alive"); res.flushHeaders?.(); const timer = setInterval(async () => { try { const [live] = await db.select().from(liveSessionsTable).where(eq(liveSessionsTable.id, Number(req.params.id))); if (!live) { res.end(); clearInterval(timer); return; } res.write(`event: live\ndata: ${JSON.stringify(live)}\n\n`); } catch {} }, 3000); req.on("close", () => clearInterval(timer)); });

export default router;
