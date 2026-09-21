import { Router, Request } from "express";
import { db } from "@workspace/db";
import { postLikesTable, postSavesTable, postsTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const postsRouter = Router();

function dbError(res: any, err: unknown) {
  if (!process.env["DATABASE_URL"]) {
    return res.status(503).json({
      error: "Database not configured. Please provision a database and set DATABASE_URL.",
    });
  }
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

// GET /api/posts/feed — get feed with author info
postsRouter.get("/posts/feed", authMiddleware, async (req: Request & { userId?: number }, res) => {
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

    const postIds = rows.map((row) => row.id);
    const [likes, saves] = postIds.length > 0
      ? await Promise.all([
          db.select({ postId: postLikesTable.postId }).from(postLikesTable)
            .where(eq(postLikesTable.userId, req.userId!)),
          db.select({ postId: postSavesTable.postId }).from(postSavesTable)
            .where(eq(postSavesTable.userId, req.userId!)),
        ])
      : [[], []];
    const likedIds = new Set(likes.map((row) => row.postId));
    const savedIds = new Set(saves.map((row) => row.postId));
    return res.json({
      posts: rows.map((row) => ({
        ...row,
        liked: likedIds.has(row.id),
        saved: savedIds.has(row.id),
      })),
    });
  } catch (err) {
    return dbError(res, err);
  }
});

export default postsRouter;
