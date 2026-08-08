import { Router, Request } from "express";
import { db } from "@workspace/db";
import { storiesTable, storyViewsTable, storyReactionsTable, storyRepliesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const storiesRouter = Router();
type AuthedRequest = Request & { userId?: number };
const dbError = (res: any, err: unknown) => { console.error(err); return res.status(500).json({ error: "Server error" }); };

storiesRouter.post("/stories", authMiddleware, async (req: AuthedRequest, res) => {
  const { mediaUrl, caption } = req.body as { mediaUrl?: string; caption?: string };
  if (!mediaUrl) return res.status(400).json({ error: "Photo required for story" });
  try { const [story] = await db.insert(storiesTable).values({ userId: req.userId!, mediaUrl, caption: caption?.trim() ?? "", expiresAt: new Date(Date.now() + 86400000) }).returning(); return res.status(201).json({ story }); } catch (err) { return dbError(res, err); }
});

storiesRouter.get("/stories", authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const rows = await db.select({ id: storiesTable.id, userId: storiesTable.userId, mediaUrl: storiesTable.mediaUrl, caption: storiesTable.caption, expiresAt: storiesTable.expiresAt, createdAt: storiesTable.createdAt,
      authorDisplayName: usersTable.displayName, authorUsername: usersTable.username, authorAvatarUrl: usersTable.avatarUrl,
      viewCount: sql<number>`(select count(*) from story_views sv where sv.story_id = ${storiesTable.id})`,
      viewed: sql<boolean>`exists(select 1 from story_views sv where sv.story_id = ${storiesTable.id} and sv.user_id = ${req.userId!})`,
    }).from(storiesTable).innerJoin(usersTable, eq(storiesTable.userId, usersTable.id)).where(gt(storiesTable.expiresAt, new Date())).orderBy(desc(storiesTable.createdAt)).limit(100);
    return res.json({ stories: rows });
  } catch (err) { return dbError(res, err); }
});

storiesRouter.post("/stories/:id/view", authMiddleware, async (req: AuthedRequest, res) => {
  const storyId = Number(req.params.id); if (!Number.isInteger(storyId)) return res.status(400).json({ error: "Invalid story id" });
  try { await db.insert(storyViewsTable).values({ storyId, userId: req.userId! }).onConflictDoUpdate({ target: [storyViewsTable.storyId, storyViewsTable.userId], set: { viewedAt: new Date() } }); return res.json({ viewed: true }); } catch (err) { return dbError(res, err); }
});

storiesRouter.post("/stories/:id/reaction", authMiddleware, async (req: AuthedRequest, res) => {
  const storyId = Number(req.params.id); const emoji = String(req.body?.emoji ?? "").trim();
  if (!Number.isInteger(storyId) || !emoji) return res.status(400).json({ error: "Invalid reaction" });
  try { await db.insert(storyReactionsTable).values({ storyId, userId: req.userId!, emoji }).onConflictDoUpdate({ target: [storyReactionsTable.storyId, storyReactionsTable.userId], set: { emoji, createdAt: new Date() } }); return res.json({ reacted: true, emoji }); } catch (err) { return dbError(res, err); }
});

storiesRouter.post("/stories/:id/replies", authMiddleware, async (req: AuthedRequest, res) => {
  const storyId = Number(req.params.id); const text = String(req.body?.text ?? "").trim();
  if (!Number.isInteger(storyId) || !text) return res.status(400).json({ error: "Reply required" });
  try { const [story] = await db.select({ userId: storiesTable.userId }).from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1); if (!story) return res.status(404).json({ error: "Story not found" }); const [reply] = await db.insert(storyRepliesTable).values({ storyId, userId: req.userId!, text }).returning(); if (story.userId !== req.userId) await db.insert(notificationsTable).values({ userId: story.userId, actorId: req.userId!, type: "story", storyId, message: "replied to your story" }); return res.status(201).json({ reply }); } catch (err) { return dbError(res, err); }
});

storiesRouter.get("/stories/:id/viewers", authMiddleware, async (req: AuthedRequest, res) => {
  const storyId = Number(req.params.id);
  try { const viewers = await db.select({ userId: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, viewedAt: storyViewsTable.viewedAt }).from(storyViewsTable).innerJoin(usersTable, eq(usersTable.id, storyViewsTable.userId)).where(eq(storyViewsTable.storyId, storyId)).orderBy(desc(storyViewsTable.viewedAt)).limit(500); return res.json({ viewers }); } catch (err) { return dbError(res, err); }
});

storiesRouter.delete("/stories/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const storyId = Number(req.params.id); if (!Number.isInteger(storyId)) return res.status(400).json({ error: "Invalid story id" });
  try { const [story] = await db.delete(storiesTable).where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, req.userId!))).returning({ id: storiesTable.id }); if (!story) return res.status(404).json({ error: "Story not found" }); return res.json({ success: true }); } catch (err) { return dbError(res, err); }
});

export default storiesRouter;
