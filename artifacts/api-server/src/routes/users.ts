import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, ilike, publicUser, selectRows, sortRows, supabaseError } from "../lib/supabase";

const usersRouter = Router();
type AuthenticatedRequest = Request & { userId?: number };

usersRouter.get("/users/search", authMiddleware, async (req, res) => {
  const query = String(req.query["q"] ?? "").trim();
  if (query.length < 2) return res.json({ users: [] });

  try {
    const pattern = `%${query.toLowerCase()}%`;
    const [byUsername, byDisplayName] = await Promise.all([
      selectRows("users", {
        select: "id,username,display_name,avatar_url,bio,country_flag",
        filters: [ilike("username", pattern)],
        limit: 20,
      }),
      selectRows("users", {
        select: "id,username,display_name,avatar_url,bio,country_flag",
        filters: [ilike("displayName", pattern)],
        limit: 20,
      }),
    ]);
    const users = sortRows(
      Array.from(new Map([...byUsername, ...byDisplayName].map((user) => [user.id, user])).values()),
      "displayName",
    ).slice(0, 20);
    return res.json({ users });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.get("/users/:id/relations", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params["id"]);
  const mode = String(req.query["mode"] ?? "followers");
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid user id" });
  if (mode !== "followers" && mode !== "following") return res.status(400).json({ error: "Invalid relation mode" });

  try {
    const relationColumn = mode === "followers" ? "followingId" : "followerId";
    const userColumn = mode === "followers" ? "followerId" : "followingId";
    const relations = await selectRows("follows", {
      filters: [eq(relationColumn, id)],
      order: { column: "createdAt", ascending: false },
      limit: 1000,
    });
    const ids = relations.map((row) => Number(row[userColumn])).filter((value) => Number.isInteger(value) && value > 0);
    if (!ids.length) return res.json({ users: [] });

    const allUsers = await selectRows("users", { limit: 1000 });
    const byId = new Map(allUsers.map((user) => [Number(user.id), user]));
    const currentFollowing = await selectRows("follows", {
      filters: [eq("followerId", req.userId!)],
      limit: 1000,
    });
    const followingIds = new Set(currentFollowing.map((row) => Number(row.followingId)));

    const result = ids.flatMap((relationId) => {
      const user = byId.get(relationId);
      if (!user) return [];
      return [{
        ...publicUser(user),
        id: relationId,
        followers: 0,
        isFollowing: followingIds.has(relationId),
      }];
    });

    const followerCounts = new Map<number, number>();
    const allFollows = await selectRows("follows", { limit: 5000 });
    for (const row of allFollows) {
      const followingId = Number(row.followingId);
      followerCounts.set(followingId, (followerCounts.get(followingId) ?? 0) + 1);
    }

    return res.json({
      users: result.map((user) => ({
        ...user,
        followers: followerCounts.get(Number(user.id)) ?? 0,
      })),
    });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.get("/users/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid user id" });

  try {
    const [user] = await selectRows("users", { filters: [eq("id", id)], limit: 1 });
    if (!user) return res.status(404).json({ error: "User not found" });
    const [posts, followsToUser, followsFromUser, currentFollow, settings] = await Promise.all([
      selectRows("posts", { filters: [eq("userId", id)], order: { column: "createdAt", ascending: false }, limit: 100 }),
      selectRows("follows", { filters: [eq("followingId", id)] }),
      selectRows("follows", { filters: [eq("followerId", id)] }),
      selectRows("follows", {
        filters: [eq("followerId", req.userId!), eq("followingId", id)],
        limit: 1,
      }),
      selectRows("user_settings", { filters: [eq("userId", id)], limit: 1 }),
    ]);
    const privateAccount = Boolean(settings[0]?.privateAccount);
    const viewerIsOwner = req.userId === id;
    const viewerFollows = currentFollow.length > 0;
    if (privateAccount && !viewerIsOwner && !viewerFollows) {
      return res.json({ user: publicUser(user), posts: [], stats: { posts: 0, followers: followsToUser.length, following: followsFromUser.length }, following: false, privateAccount: true });
    }
    return res.json({
      user: publicUser(user),
      posts,
      stats: { posts: posts.length, followers: followsToUser.length, following: followsFromUser.length },
      following: viewerFollows,
      privateAccount,
    });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default usersRouter;