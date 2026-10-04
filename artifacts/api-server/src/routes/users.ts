import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { deleteRows, eq, insertRow, publicUser, selectRows, sortRows, supabaseError, updateRows } from "../lib/supabase";

const usersRouter = Router();
type AuthenticatedRequest = Request & { userId?: number };

usersRouter.get("/users/search", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const query = String(req.query["q"] ?? "").trim();
  try {
    const allUsers = await selectRows("users", {
      select: "id,username,display_name,avatar_url,bio,country_flag",
      limit: 1000,
    });
    const normalized = query.toLowerCase();
    const users = (normalized.length < 2 ? [] : allUsers.filter((user) => {
      const username = String(user.username ?? "").toLowerCase();
      const displayName = String(user.displayName ?? "").toLowerCase();
      const bio = String(user.bio ?? "").toLowerCase();
      return username.includes(normalized) || displayName.includes(normalized) || bio.includes(normalized);
    })).slice(0, 30);

    const allPosts = await selectRows("posts", {
      order: { column: "createdAt", ascending: false },
      limit: 1000,
    });
    const byId = new Map(allUsers.map((user) => [Number(user.id), user]));
    const blocked = await selectRows("blocked_users", { limit: 5000 }).catch(() => []);
    const blockedIds = new Set<number>();
    for (const row of blocked) {
      const blocker = Number(row.blockerId);
      const blockedUser = Number(row.blockedId);
      if (blocker === req.userId!) blockedIds.add(blockedUser);
      if (blockedUser === req.userId!) blockedIds.add(blocker);
    }

    const matchingPosts = allPosts.filter((post) => {
      const authorId = Number(post.userId);
      if (blockedIds.has(authorId) || Boolean(post.deletedAt)) return false;
      if (normalized.length < 2) return true;
      const haystack = [
        post.caption,
        post.hashtags,
        post.location,
      ].map((value) => String(value ?? "").toLowerCase()).join(" ");
      return haystack.includes(normalized);
    }).slice(0, 30).map((post) => ({
      ...post,
      author: publicUser(byId.get(Number(post.userId)) ?? {}),
    }));

    const hashtagCounts = new Map<string, number>();
    for (const post of allPosts) {
      const tags = String(post.hashtags ?? "").toLowerCase().split(/[,\\s#]+/).filter(Boolean);
      for (const tag of tags) hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
    }
    const hashtags = Array.from(hashtagCounts.entries())
      .filter(([tag]) => normalized.length < 2 || tag.includes(normalized))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, posts: count }));

    return res.json({ users, posts: matchingPosts, hashtags });
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


function mapFriendUser(user: Record<string, unknown>, followers = 0, mutualFriends = 0) {
  return {
    id: Number(user.id),
    avatar: String(user.avatarUrl ?? ""),
    displayName: String(user.displayName ?? user.username ?? ""),
    username: String(user.username ?? ""),
    followers,
    mutualFriends,
  };
}

async function followerCounts() {
  const follows = await selectRows("follows", { limit: 5000 });
  const counts = new Map<number, number>();
  for (const row of follows) {
    const id = Number(row.followingId);
    if (Number.isInteger(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

usersRouter.get("/friend-requests", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const incoming = await selectRows("follows", {
      filters: [eq("followingId", req.userId!), eq("status", "pending")],
      order: { column: "createdAt", ascending: false },
      limit: 100,
    });
    const ids = incoming.map((row) => Number(row.followerId)).filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) return res.json({ requests: [] });
    const [allUsers, counts] = await Promise.all([
      selectRows("users", { limit: 1000 }),
      followerCounts(),
    ]);
    const byId = new Map(allUsers.map((user) => [Number(user.id), user]));
    const requests = ids.flatMap((id) => {
      const user = byId.get(id);
      if (!user) return [];
      return [{ user: mapFriendUser(user, counts.get(id) ?? 0, 0), mutualFriends: 0 }];
    });
    return res.json({ requests });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.get("/friend-requests/sent", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const outgoing = await selectRows("follows", {
      filters: [eq("followerId", req.userId!), eq("status", "pending")],
      order: { column: "createdAt", ascending: false },
      limit: 100,
    });
    const ids = outgoing.map((row) => Number(row.followingId)).filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) return res.json({ users: [] });
    const [allUsers, counts] = await Promise.all([
      selectRows("users", { limit: 1000 }),
      followerCounts(),
    ]);
    const byId = new Map(allUsers.map((user) => [Number(user.id), user]));
    return res.json({
      users: ids.flatMap((id) => {
        const user = byId.get(id);
        return user ? [mapFriendUser(user, counts.get(id) ?? 0)] : [];
      }),
    });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.get("/friends/suggestions", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const [allUsers, allFollows, counts] = await Promise.all([
      selectRows("users", { limit: 1000 }),
      selectRows("follows", { limit: 5000 }),
      followerCounts(),
    ]);
    const related = new Set<number>();
    for (const row of allFollows) {
      const followerId = Number(row.followerId);
      const followingId = Number(row.followingId);
      if (followerId === req.userId!) related.add(followingId);
      if (followingId === req.userId!) related.add(followerId);
    }
    const suggestions = allUsers
      .filter((user) => {
        const id = Number(user.id);
        return id > 0 && id !== req.userId! && !related.has(id);
      })
      .sort((a, b) => (counts.get(Number(b.id)) ?? 0) - (counts.get(Number(a.id)) ?? 0))
      .slice(0, 20)
      .map((user) => mapFriendUser(user, counts.get(Number(user.id)) ?? 0));
    return res.json({ users: suggestions });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.post("/friend-requests/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const targetId = Number(req.params["id"]);
  if (!Number.isInteger(targetId) || targetId <= 0 || targetId === req.userId) {
    return res.status(400).json({ error: "Invalid friend request target" });
  }
  try {
    const [target] = await selectRows("users", { filters: [eq("id", targetId)], limit: 1 });
    if (!target) return res.status(404).json({ error: "User not found" });
    const existing = await selectRows("follows", {
      filters: [eq("followerId", req.userId!), eq("followingId", targetId)],
      limit: 1,
    });
    if (existing.length) return res.status(409).json({ error: "Request already exists" });
    const incoming = await selectRows("follows", {
      filters: [eq("followerId", targetId), eq("followingId", req.userId!)],
      limit: 1,
    });
    if (incoming.length && String(incoming[0].status ?? "") === "pending") {
      await updateRows("follows", { status: "accepted", isFriend: true }, [
        eq("followerId", targetId),
        eq("followingId", req.userId!),
      ]);
      await insertRow("follows", { followerId: req.userId!, followingId: targetId, isFriend: true, status: "accepted" });
      const { ensureFriendConversation } = await import("./messages");
      await ensureFriendConversation(req.userId!, targetId);
      return res.json({ status: "accepted", friend: true });
    }
    await insertRow("follows", { followerId: req.userId!, followingId: targetId, isFriend: false, status: "pending" });
    return res.status(201).json({ status: "pending" });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.delete("/friend-requests/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const targetId = Number(req.params["id"]);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: "Invalid user id" });
  try {
    const incoming = await selectRows("follows", {
      filters: [eq("followerId", targetId), eq("followingId", req.userId!), eq("status", "pending")],
      limit: 1,
    });
    const outgoing = await selectRows("follows", {
      filters: [eq("followerId", req.userId!), eq("followingId", targetId), eq("status", "pending")],
      limit: 1,
    });
    if (incoming.length) {
      await deleteRows("follows", [eq("followerId", targetId), eq("followingId", req.userId!), eq("status", "pending")]);
    } else if (outgoing.length) {
      await deleteRows("follows", [eq("followerId", req.userId!), eq("followingId", targetId), eq("status", "pending")]);
    } else {
      return res.status(404).json({ error: "Friend request not found" });
    }
    return res.json({ ok: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

usersRouter.post("/friend-requests/:id/accept", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const requesterId = Number(req.params["id"]);
  if (!Number.isInteger(requesterId) || requesterId <= 0) return res.status(400).json({ error: "Invalid requester id" });
  try {
    const pending = await selectRows("follows", {
      filters: [eq("followerId", requesterId), eq("followingId", req.userId!), eq("status", "pending")],
      limit: 1,
    });
    if (!pending.length) return res.status(404).json({ error: "Friend request not found" });
    await updateRows("follows", { status: "accepted", isFriend: true }, [
      eq("followerId", requesterId),
      eq("followingId", req.userId!),
    ]);
    const reciprocal = await selectRows("follows", {
      filters: [eq("followerId", req.userId!), eq("followingId", requesterId)],
      limit: 1,
    });
    if (reciprocal.length) {
      await updateRows("follows", { status: "accepted", isFriend: true }, [
        eq("followerId", req.userId!),
        eq("followingId", requesterId),
      ]);
    } else {
      await insertRow("follows", { followerId: req.userId!, followingId: requesterId, isFriend: true, status: "accepted" });
    }
    const { ensureFriendConversation } = await import("./messages");
    await ensureFriendConversation(req.userId!, requesterId);
    return res.json({ accepted: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default usersRouter;