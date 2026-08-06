import { Router, Request } from "express";
import { db } from "@workspace/db";
import { postsTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
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

// GET /api/posts/feed — get feed with author info
postsRouter.get("/posts/feed", authMiddleware, async (_req, res) => {
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

export default postsRouter;
