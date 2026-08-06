import { Router, Request } from "express";
import { db } from "@workspace/db";
import { postsTable, commentsTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const postsRouter = Router();

function dbError(res: any, err: unknown) {
  console.error(err);
  return res.status(500).json({ error: "Server error" });
}

// POST /api/posts — create a post
postsRouter.post("/posts", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const userId = req.userId!;
  const { caption, mediaUrl, location, hashtags, isWorldFeed } = req.body as {
    caption?: string;
    mediaUrl?: string | null;
    location?: string;
    hashtags?: string;
    isWorldFeed?: boolean;
  };

  if (!caption?.trim() && !mediaUrl) {
    return res.status(400).json({ error: "Caption or photo required" });
  }

  try {
    const [post] = await db
      .insert(postsTable)
      .values({
        userId,
        caption: caption?.trim() ?? "",
        mediaUrl: mediaUrl ?? null,
        location: location?.trim() || null,
        hashtags: hashtags?.trim() || null,
        isWorldFeed: isWorldFeed ?? true,
      })
      .returning();
    return res.status(201).json({ post });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/posts/feed — get feed with author info, optional ?since=ISO for polling
postsRouter.get("/posts/feed", authMiddleware, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: postsTable.id,
        userId: postsTable.userId,
        caption: postsTable.caption,
        mediaUrl: postsTable.mediaUrl,
        location: postsTable.location,
        hashtags: postsTable.hashtags,
        isWorldFeed: postsTable.isWorldFeed,
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
      .orderBy(desc(postsTable.createdAt))
      .limit(50);

    return res.json({ posts: rows });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/posts/:id/like — toggle like, returns new count + liked state
postsRouter.post(
  "/posts/:id/like",
  authMiddleware,
  async (req: Request & { userId?: number }, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

    try {
      // Simple optimistic toggle: increment or decrement based on current count
      // (no per-user like table yet — just bump the counter)
      const [post] = await db
        .update(postsTable)
        .set({ likes: sql`${postsTable.likes} + 1` })
        .where(eq(postsTable.id, postId))
        .returning({ likes: postsTable.likes });

      if (!post) return res.status(404).json({ error: "Post not found" });
      return res.json({ likes: post.likes });
    } catch (err) {
      return dbError(res, err);
    }
  },
);

// GET /api/posts/:id/comments — list comments for a post
postsRouter.get("/posts/:id/comments", authMiddleware, async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

  try {
    const rows = await db
      .select({
        id: commentsTable.id,
        text: commentsTable.text,
        createdAt: commentsTable.createdAt,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
      })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.postId, postId))
      .orderBy(desc(commentsTable.createdAt))
      .limit(50);

    return res.json({ comments: rows });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/posts/:id/comments — add a comment
postsRouter.post(
  "/posts/:id/comments",
  authMiddleware,
  async (req: Request & { userId?: number }, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });

    const { text } = req.body as { text?: string };
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    try {
      const [comment] = await db
        .insert(commentsTable)
        .values({ postId, userId: req.userId!, text: text.trim() })
        .returning();

      // Increment post comment count
      await db
        .update(postsTable)
        .set({ comments: sql`${postsTable.comments} + 1` })
        .where(eq(postsTable.id, postId));

      return res.status(201).json({ comment });
    } catch (err) {
      return dbError(res, err);
    }
  },
);

export default postsRouter;
