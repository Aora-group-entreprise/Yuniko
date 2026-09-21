import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  commentsTable,
  followsTable,
  notificationsTable,
  postLikesTable,
  postSavesTable,
  postsTable,
  usersTable,
} from "@workspace/db/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const interactionsRouter = Router();
type AuthenticatedRequest = Request & { userId?: number };

function dbError(res: any, err: unknown) {
  if (!process.env["DATABASE_URL"]) {
    return res.status(503).json({
      error: "Database not configured. Please provision a database and set DATABASE_URL.",
    });
  }
  console.error(err);
  return res.status(500).json({ error: "Server error" });
}

function parseId(value: string | string[] | undefined): number | null {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function countRows(table: typeof postLikesTable | typeof postSavesTable, postId: number) {
  const [result] = await db
    .select({ count: count() })
    .from(table)
    .where(eq(table.postId, postId));
  return Number(result?.count ?? 0);
}

async function notify(
  recipientId: number,
  actorId: number,
  type: string,
  text: string,
  postId?: number,
) {
  if (recipientId === actorId) return;
  await db.insert(notificationsTable).values({ recipientId, actorId, type, text, postId });
}

interactionsRouter.get("/notifications", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = await db
      .select({
        id: notificationsTable.id,
        type: notificationsTable.type,
        text: notificationsTable.text,
        read: notificationsTable.read,
        postId: notificationsTable.postId,
        createdAt: notificationsTable.createdAt,
        actorId: usersTable.id,
        actorUsername: usersTable.username,
        actorDisplayName: usersTable.displayName,
        actorAvatarUrl: usersTable.avatarUrl,
      })
      .from(notificationsTable)
      .innerJoin(usersTable, eq(notificationsTable.actorId, usersTable.id))
      .where(eq(notificationsTable.recipientId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(100);
    return res.json({ notifications });
  } catch (err) {
    return dbError(res, err);
  }
});

interactionsRouter.patch("/notifications/read-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    await db.update(notificationsTable).set({ read: true })
      .where(eq(notificationsTable.recipientId, req.userId!));
    return res.json({ ok: true });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/posts/saved — posts saved by the current user
interactionsRouter.get("/posts/saved", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const posts = await db
      .select({
        id: postsTable.id,
        userId: postsTable.userId,
        caption: postsTable.caption,
        mediaUrl: postsTable.mediaUrl,
        location: postsTable.location,
        hashtags: postsTable.hashtags,
        likes: postsTable.likes,
        comments: postsTable.comments,
        shares: postsTable.shares,
        saves: postsTable.saves,
        createdAt: postsTable.createdAt,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
      })
      .from(postSavesTable)
      .innerJoin(postsTable, eq(postSavesTable.postId, postsTable.id))
      .innerJoin(usersTable, eq(postsTable.userId, usersTable.id))
      .where(eq(postSavesTable.userId, req.userId!))
      .orderBy(desc(postSavesTable.createdAt))
      .limit(100);
    return res.json({ posts });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/posts/:id — one persisted post with the current user's state
interactionsRouter.get("/posts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });

  try {
    const [post] = await db
      .select({
        id: postsTable.id,
        userId: postsTable.userId,
        caption: postsTable.caption,
        mediaUrl: postsTable.mediaUrl,
        location: postsTable.location,
        hashtags: postsTable.hashtags,
        likes: postsTable.likes,
        comments: postsTable.comments,
        shares: postsTable.shares,
        saves: postsTable.saves,
        createdAt: postsTable.createdAt,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
      })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.userId, usersTable.id))
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) return res.status(404).json({ error: "Post not found" });
    const [like, save] = await Promise.all([
      db.select({ postId: postLikesTable.postId }).from(postLikesTable)
        .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, req.userId!))).limit(1),
      db.select({ postId: postSavesTable.postId }).from(postSavesTable)
        .where(and(eq(postSavesTable.postId, postId), eq(postSavesTable.userId, req.userId!))).limit(1),
    ]);
    return res.json({ post, liked: like.length > 0, saved: save.length > 0 });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/posts/:id/like — idempotent toggle
interactionsRouter.post("/posts/:id/like", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });

  try {
    const existing = await db.select({ postId: postLikesTable.postId }).from(postLikesTable)
      .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, req.userId!))).limit(1);
    if (existing.length > 0) {
      await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, req.userId!)));
    } else {
      await db.insert(postLikesTable).values({ postId, userId: req.userId! }).onConflictDoNothing();
    }
    const likes = await countRows(postLikesTable, postId);
    await db.update(postsTable).set({ likes }).where(eq(postsTable.id, postId));
    if (existing.length === 0) {
      const [post] = await db.select({ userId: postsTable.userId }).from(postsTable)
        .where(eq(postsTable.id, postId)).limit(1);
      if (post) await notify(post.userId, req.userId!, "like", "liked your post", postId);
    }
    return res.json({ liked: existing.length === 0, likes });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/posts/:id/save — idempotent toggle
interactionsRouter.post("/posts/:id/save", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });

  try {
    const existing = await db.select({ postId: postSavesTable.postId }).from(postSavesTable)
      .where(and(eq(postSavesTable.postId, postId), eq(postSavesTable.userId, req.userId!))).limit(1);
    if (existing.length > 0) {
      await db.delete(postSavesTable).where(and(eq(postSavesTable.postId, postId), eq(postSavesTable.userId, req.userId!)));
    } else {
      await db.insert(postSavesTable).values({ postId, userId: req.userId! }).onConflictDoNothing();
    }
    const saves = await countRows(postSavesTable, postId);
    await db.update(postsTable).set({ saves }).where(eq(postsTable.id, postId));
    return res.json({ saved: existing.length === 0, saves });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/posts/:id/comments
interactionsRouter.get("/posts/:id/comments", authMiddleware, async (req, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });

  try {
    const comments = await db
      .select({
        id: commentsTable.id,
        text: commentsTable.text,
        createdAt: commentsTable.createdAt,
        userId: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.postId, postId))
      .orderBy(desc(commentsTable.createdAt))
      .limit(100);
    return res.json({ comments });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/posts/:id/comments
interactionsRouter.post("/posts/:id/comments", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  if (!text || text.length > 1000) return res.status(400).json({ error: "Comment must be between 1 and 1000 characters" });

  try {
    const [comment] = await db.insert(commentsTable)
      .values({ postId, userId: req.userId!, text })
      .returning();
    const [commentCount] = await db
      .select({ count: count() })
      .from(commentsTable)
      .where(eq(commentsTable.postId, postId));
    await db.update(postsTable)
      .set({ comments: Number(commentCount?.count ?? 0) })
      .where(eq(postsTable.id, postId));
    const [post] = await db.select({ userId: postsTable.userId }).from(postsTable)
      .where(eq(postsTable.id, postId)).limit(1);
    if (post) await notify(post.userId, req.userId!, "comment", "commented on your post", postId);
    return res.status(201).json({ comment });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/users/:id/follow — idempotent toggle
interactionsRouter.post("/users/:id/follow", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const followingId = parseId(req.params["id"]);
  if (!followingId) return res.status(400).json({ error: "Invalid user id" });
  if (followingId === req.userId) return res.status(400).json({ error: "You cannot follow yourself" });

  try {
    const existing = await db.select({ followerId: followsTable.followerId }).from(followsTable)
      .where(and(eq(followsTable.followerId, req.userId!), eq(followsTable.followingId, followingId))).limit(1);
    if (existing.length > 0) {
      await db.delete(followsTable).where(and(eq(followsTable.followerId, req.userId!), eq(followsTable.followingId, followingId)));
    } else {
      await db.insert(followsTable).values({ followerId: req.userId!, followingId }).onConflictDoNothing();
      await notify(followingId, req.userId!, "follow", "started following you");
    }
    return res.json({ following: existing.length === 0 });
  } catch (err) {
    return dbError(res, err);
  }
});

export default interactionsRouter;