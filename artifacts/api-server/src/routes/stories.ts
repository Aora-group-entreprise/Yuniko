import { Router, Request } from "express";
import { db } from "@workspace/db";
import { storiesTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { and, eq, desc, gt } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const storiesRouter = Router();

function dbError(res: any, err: unknown) {
  console.error(err);
  return res.status(500).json({ error: "Server error" });
}

// POST /api/stories — create a story (expires in 24h)
storiesRouter.post("/stories", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const userId = req.userId!;
  const { mediaUrl, caption } = req.body as {
    mediaUrl?: string;
    caption?: string;
  };

  if (!mediaUrl) {
    return res.status(400).json({ error: "Photo required for story" });
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const [story] = await db
      .insert(storiesTable)
      .values({ userId, mediaUrl, caption: caption?.trim() ?? "", expiresAt })
      .returning();
    return res.status(201).json({ story });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/stories — get all active (non-expired) stories
storiesRouter.get("/stories", authMiddleware, async (_req, res) => {
  const now = new Date();
  try {
    const rows = await db
      .select({
        id: storiesTable.id,
        userId: storiesTable.userId,
        mediaUrl: storiesTable.mediaUrl,
        caption: storiesTable.caption,
        expiresAt: storiesTable.expiresAt,
        createdAt: storiesTable.createdAt,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
      })
      .from(storiesTable)
      .innerJoin(usersTable, eq(storiesTable.userId, usersTable.id))
      .where(gt(storiesTable.expiresAt, now))
      .orderBy(desc(storiesTable.createdAt))
      .limit(30);

    return res.json({ stories: rows });
  } catch (err) {
    return dbError(res, err);
  }
});

// DELETE /api/stories/:id — delete own active or expired story
storiesRouter.delete("/stories/:id", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const storyId = Number(req.params.id);
  if (!Number.isInteger(storyId)) return res.status(400).json({ error: "Invalid story id" });
  try {
    const [story] = await db
      .delete(storiesTable)
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, req.userId!)))
      .returning({ id: storiesTable.id, userId: storiesTable.userId });
    if (!story || story.userId !== req.userId) return res.status(404).json({ error: "Story not found" });
    return res.json({ success: true });
  } catch (err) {
    return dbError(res, err);
  }
});

export default storiesRouter;
