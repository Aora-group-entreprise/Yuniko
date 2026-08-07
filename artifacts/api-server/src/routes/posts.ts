import { Router, Request } from "express";
import { db } from "@workspace/db";
import { postsTable, commentsTable, postEngagementsTable, notificationsTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const postsRouter = Router();

type AuthedRequest = Request & { userId?: number };

function dbError(res: any, err: unknown) {
  console.error(err);
  return res.status(500).json({ error: "Server error" });
}

function parseMediaItems(mediaItems: unknown): string | null {
  if (!Array.isArray(mediaItems)) return null;
  const clean = mediaItems.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 10);
  return clean.length ? JSON.stringify(clean) : null;
}

function mediaTypeFor(mediaUrl?: string | null, mediaItems?: string | null, requested?: string) {
  if (requested && ["image", "video", "carousel", "text"].includes(requested)) return requested;
  if (mediaItems) return "carousel";
  if (!mediaUrl) return "text";
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl) || mediaUrl.startsWith("data:video") ? "video" : "image";
}

async function engagementFor(userId: number, postId: number) {
  const [row] = await db.select().from(postEngagementsTable).where(and(eq(postEngagementsTable.userId, userId), eq(postEngagementsTable.postId, postId))).limit(1);
  return row;
}

async function createNotification(userId: number, actorId: number, type: string, postId: number | null, message: string) {
  if (userId === actorId) return;
  await db.insert(notificationsTable).values({ userId, actorId, type, postId, message }).catch(() => undefined);
}

postsRouter.post("/posts", authMiddleware, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const { caption, mediaUrl, mediaItems, location, hashtags, isWorldFeed, mediaType } = req.body as {
    caption?: string; mediaUrl?: string | null; mediaItems?: unknown; location?: string; hashtags?: string; isWorldFeed?: boolean; mediaType?: string;
  };
  const serializedMediaItems = parseMediaItems(mediaItems);
  if (!caption?.trim() && !mediaUrl && !serializedMediaItems) return res.status(400).json({ error: "Post text, photo, or video required" });

  try {
    const [post] = await db.insert(postsTable).values({
      userId,
      caption: caption?.trim() ?? "",
      mediaUrl: mediaUrl ?? null,
      mediaItems: serializedMediaItems,
      mediaType: mediaTypeFor(mediaUrl, serializedMediaItems, mediaType),
      location: location?.trim() || null,
      hashtags: hashtags?.trim() || null,
      isWorldFeed: isWorldFeed ?? true,
      distributionTier: 0,
    }).returning();
    return res.status(201).json({ post });
  } catch (err) { return dbError(res, err); }
});

postsRouter.get("/posts/feed", authMiddleware, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  try {
    const rows = await db.select({
      id: postsTable.id, userId: postsTable.userId, caption: postsTable.caption, mediaUrl: postsTable.mediaUrl,
      mediaType: postsTable.mediaType, mediaItems: postsTable.mediaItems, location: postsTable.location, hashtags: postsTable.hashtags,
      isWorldFeed: postsTable.isWorldFeed, likes: postsTable.likes, comments: postsTable.comments, shares: postsTable.shares,
      saves: postsTable.saves, views: postsTable.views, reports: postsTable.reports, viralScore: postsTable.viralScore,
      distributionTier: postsTable.distributionTier, createdAt: postsTable.createdAt,
      authorDisplayName: usersTable.displayName, authorUsername: usersTable.username, authorAvatarUrl: usersTable.avatarUrl,
      liked: postEngagementsTable.liked, saved: postEngagementsTable.saved, reported: postEngagementsTable.reported,
    }).from(postsTable)
      .innerJoin(usersTable, eq(postsTable.userId, usersTable.id))
      .leftJoin(postEngagementsTable, and(eq(postEngagementsTable.postId, postsTable.id), eq(postEngagementsTable.userId, userId)))
      .orderBy(desc(postsTable.viralScore), desc(postsTable.createdAt)).limit(50);
    return res.json({ posts: rows });
  } catch (err) { return dbError(res, err); }
});

postsRouter.patch("/posts/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id); if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  const { caption, location, hashtags } = req.body as { caption?: string; location?: string | null; hashtags?: string | null };
  try {
    const [post] = await db.update(postsTable).set({ caption: caption?.trim() ?? "", location: location || null, hashtags: hashtags || null, updatedAt: new Date() }).where(and(eq(postsTable.id, postId), eq(postsTable.userId, req.userId!))).returning();
    if (!post) return res.status(404).json({ error: "Post not found" });
    return res.json({ post });
  } catch (err) { return dbError(res, err); }
});

postsRouter.delete("/posts/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id); if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await db.delete(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.userId, req.userId!))).returning({ id: postsTable.id });
    if (!post) return res.status(404).json({ error: "Post not found" });
    return res.json({ success: true });
  } catch (err) { return dbError(res, err); }
});

async function toggleBooleanEngagement(req: AuthedRequest, postId: number, field: "liked" | "saved" | "shared" | "reported") {
  const userId = req.userId!;
  const existing = await engagementFor(userId, postId);
  if (!existing) {
    const [created] = await db.insert(postEngagementsTable).values({ postId, userId, [field]: true, updatedAt: new Date() }).returning();
    return { active: true, previous: false, row: created };
  }
  const next = !existing[field];
  const [row] = await db.update(postEngagementsTable).set({ [field]: next, updatedAt: new Date() }).where(eq(postEngagementsTable.id, existing.id)).returning();
  return { active: next, previous: existing[field], row };
}

async function handlePostAction(req: AuthedRequest, res: any, action: "like" | "save" | "share" | "report") {
  const postId = Number(req.params.id); if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  const field = ({ like: "liked", save: "saved", share: "shared", report: "reported" } as const)[action];
  const counter = ({ like: postsTable.likes, save: postsTable.saves, share: postsTable.shares, report: postsTable.reports } as const)[action];
  try {
    const [target] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!target) return res.status(404).json({ error: "Post not found" });
    const result = await toggleBooleanEngagement(req, postId, field);
    const delta = result.active && !result.previous ? 1 : !result.active && result.previous ? -1 : 0;
    const [post] = await db.update(postsTable).set({ [action === "like" ? "likes" : action === "save" ? "saves" : action === "share" ? "shares" : "reports"]: sql`${counter} + ${delta}`, updatedAt: new Date() }).where(eq(postsTable.id, postId)).returning();
    await createNotification(target.userId, req.userId!, action, postId, `Your post was ${action === "like" ? "liked" : action === "save" ? "saved" : action === "share" ? "shared" : "reported"}.`);
    return res.json({ active: result.active, post });
  } catch (err) { return dbError(res, err); }
}

postsRouter.post("/posts/:id/like", authMiddleware, (req: AuthedRequest, res) => handlePostAction(req, res, "like"));
postsRouter.post("/posts/:id/save", authMiddleware, (req: AuthedRequest, res) => handlePostAction(req, res, "save"));
postsRouter.post("/posts/:id/share", authMiddleware, (req: AuthedRequest, res) => handlePostAction(req, res, "share"));
postsRouter.post("/posts/:id/report", authMiddleware, (req: AuthedRequest, res) => handlePostAction(req, res, "report"));

postsRouter.post("/posts/:id/view", authMiddleware, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id); if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  const watchMs = Math.max(0, Math.min(Number(req.body?.watchMs ?? 0), 3_600_000));
  const completionRate = Math.max(0, Math.min(Number(req.body?.completionRate ?? 0), 100));
  try {
    const existing = await engagementFor(req.userId!, postId);
    if (!existing) await db.insert(postEngagementsTable).values({ postId, userId: req.userId!, viewCount: 1, watchMs, completionRate, lastViewedAt: new Date() });
    else await db.update(postEngagementsTable).set({ viewCount: sql`${postEngagementsTable.viewCount} + 1`, watchMs: Math.max(existing.watchMs, watchMs), completionRate: Math.max(existing.completionRate, completionRate), lastViewedAt: new Date(), updatedAt: new Date() }).where(eq(postEngagementsTable.id, existing.id));
    const score = sql`${postsTable.views} + (${postsTable.likes} * 8) + (${postsTable.comments} * 12) + (${postsTable.shares} * 18) + (${postsTable.saves} * 14) - (${postsTable.reports} * 40)`;
    const [post] = await db.update(postsTable).set({ views: sql`${postsTable.views} + 1`, viralScore: score, distributionTier: sql`CASE WHEN ${score} > 5000 THEN 4 WHEN ${score} > 1200 THEN 3 WHEN ${score} > 250 THEN 2 WHEN ${score} > 50 THEN 1 ELSE ${postsTable.distributionTier} END`, updatedAt: new Date() }).where(eq(postsTable.id, postId)).returning();
    if (!post) return res.status(404).json({ error: "Post not found" });
    return res.json({ post });
  } catch (err) { return dbError(res, err); }
});

postsRouter.get("/posts/:id/comments", authMiddleware, async (req, res) => {
  const postId = Number(req.params.id); if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  try {
    const rows = await db.select({ id: commentsTable.id, text: commentsTable.text, createdAt: commentsTable.createdAt, authorDisplayName: usersTable.displayName, authorUsername: usersTable.username, authorAvatarUrl: usersTable.avatarUrl }).from(commentsTable).innerJoin(usersTable, eq(commentsTable.userId, usersTable.id)).where(eq(commentsTable.postId, postId)).orderBy(desc(commentsTable.createdAt)).limit(50);
    return res.json({ comments: rows });
  } catch (err) { return dbError(res, err); }
});

postsRouter.post("/posts/:id/comments", authMiddleware, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.id); if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  const { text } = req.body as { text?: string }; if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });
  try {
    const [target] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!target) return res.status(404).json({ error: "Post not found" });
    const [comment] = await db.insert(commentsTable).values({ postId, userId: req.userId!, text: text.trim() }).returning();
    await db.update(postsTable).set({ comments: sql`${postsTable.comments} + 1`, updatedAt: new Date() }).where(eq(postsTable.id, postId));
    await createNotification(target.userId, req.userId!, "comment", postId, "Your post received a new comment.");
    return res.status(201).json({ comment });
  } catch (err) { return dbError(res, err); }
});

postsRouter.delete("/posts/:postId/comments/:commentId", authMiddleware, async (req: AuthedRequest, res) => {
  const postId = Number(req.params.postId);
  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(postId) || !Number.isInteger(commentId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [comment] = await db.delete(commentsTable).where(and(eq(commentsTable.id, commentId), eq(commentsTable.postId, postId), eq(commentsTable.userId, req.userId!))).returning({ id: commentsTable.id });
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    await db.update(postsTable).set({ comments: sql`GREATEST(${postsTable.comments} - 1, 0)`, updatedAt: new Date() }).where(eq(postsTable.id, postId));
    return res.json({ success: true });
  } catch (err) { return dbError(res, err); }
});

export default postsRouter;
