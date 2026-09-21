import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { followsTable, postsTable, usersTable } from "@workspace/db/schema";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const usersRouter = Router();
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

function publicUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// GET /api/users/search?q=... — search real registered users
usersRouter.get("/users/search", authMiddleware, async (req, res) => {
  const query = String(req.query["q"] ?? "").trim();
  if (query.length < 2) return res.json({ users: [] });

  try {
    const pattern = `%${query.toLowerCase()}%`;
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        bio: usersTable.bio,
        countryFlag: usersTable.countryFlag,
      })
      .from(usersTable)
      .where(
        or(
          ilike(usersTable.username, pattern),
          ilike(usersTable.displayName, pattern),
        ),
      )
      .orderBy(usersTable.displayName)
      .limit(20);

    return res.json({ users });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/users/:id — profile data and the user's persisted posts
usersRouter.get("/users/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    const [posts, followerCount, followingCount, following] = await Promise.all([
      db
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
        })
        .from(postsTable)
        .where(eq(postsTable.userId, id))
        .orderBy(desc(postsTable.createdAt))
        .limit(100),
      db.select({ count: count() }).from(followsTable).where(eq(followsTable.followingId, id)),
      db.select({ count: count() }).from(followsTable).where(eq(followsTable.followerId, id)),
      db.select({ followerId: followsTable.followerId }).from(followsTable)
        .where(and(eq(followsTable.followerId, req.userId!), eq(followsTable.followingId, id))).limit(1),
    ]);

    return res.json({
      user: publicUser(user),
      posts,
      stats: {
        posts: posts.length,
        followers: Number(followerCount[0]?.count ?? 0),
        following: Number(followingCount[0]?.count ?? 0),
      },
      following: following.length > 0,
    });
  } catch (err) {
    return dbError(res, err);
  }
});

export default usersRouter;