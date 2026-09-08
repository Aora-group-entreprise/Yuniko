import { Router, type Request } from "express";
import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable, postEngagementsTable, postsTable, usersTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { positiveId } from "../middlewares/validation";
import { rateLimit } from "../middlewares/rate-limit";

const router = Router();
type AuthedRequest = Request & { userId?: number };
const actionLimiter = rateLimit({ windowMs: 60_000, max: 30, message: "Too many repost actions. Please wait a minute." });

router.get("/posts/reposted", authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const rows = await db.select({
      post: postsTable,
      repostedAt: postEngagementsTable.updatedAt,
    })
      .from(postEngagementsTable)
      .innerJoin(postsTable, eq(postsTable.id, postEngagementsTable.postId))
      .where(and(eq(postEngagementsTable.userId, req.userId!), eq(postEngagementsTable.reposted, true)))
      .orderBy(desc(postEngagementsTable.updatedAt))
      .limit(100);
    return res.json({ posts: rows.map((row) => ({ ...row.post, repostedAt: row.repostedAt })) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/posts/:id/repost", authMiddleware, actionLimiter, async (req: AuthedRequest, res) => {
  const postId = positiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await db.select({ id: postsTable.id, userId: postsTable.userId })
      .from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const [existing] = await db.select().from(postEngagementsTable)
      .where(and(eq(postEngagementsTable.postId, postId), eq(postEngagementsTable.userId, req.userId!))).limit(1);

    if (!existing) {
      await db.insert(postEngagementsTable).values({ postId, userId: req.userId!, reposted: true, updatedAt: new Date() });
    } else if (existing.reposted) {
      await db.update(postEngagementsTable).set({ reposted: false, updatedAt: new Date() })
        .where(eq(postEngagementsTable.id, existing.id));
    } else {
      await db.update(postEngagementsTable).set({ reposted: true, updatedAt: new Date() })
        .where(eq(postEngagementsTable.id, existing.id));
    }

    const active = !Boolean(existing?.reposted);
    const delta = active ? 1 : -1;
    const [updated] = await db.update(postsTable)
      .set({ reposts: sql`GREATEST(${postsTable.reposts} + ${delta}, 0)`, updatedAt: new Date() })
      .where(eq(postsTable.id, postId)).returning();

    if (active && post.userId !== req.userId) {
      await db.insert(notificationsTable).values({
        userId: post.userId,
        actorId: req.userId!,
        type: "repost",
        postId,
        message: "Your post was reposted.",
      }).catch(() => undefined);
    }

    return res.json({ active, reposted: active, post: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
