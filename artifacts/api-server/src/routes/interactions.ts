import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  deleteRows,
  eq,
  insertRow,
  selectRows,
  sortRows,
  supabaseError,
  updateRows,
} from "../lib/supabase";
import { canInteract } from "../lib/privacy";

const interactionsRouter = Router();
type AuthenticatedRequest = Request & { userId?: number };

function parseId(value: string | string[] | undefined): number | null {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function countFor(table: string, postId: number) {
  return (await selectRows(table, { select: "post_id", filters: [eq("postId", postId)] })).length;
}

async function notify(recipientId: number, actorId: number, type: string, text: string, postId?: number) {
  if (recipientId === actorId) return;
  const [settings] = await selectRows("user_settings", { filters: [eq("userId", recipientId)], limit: 1 });
  if (settings?.pushNotifications === false && settings?.emailNotifications === false) return;
  await insertRow("notifications", { recipientId, actorId, type, text, postId: postId ?? null, read: false });
}

async function usersById() {
  const users = await selectRows("users", { limit: 1000 });
  return new Map(users.map((user) => [Number(user.id), user]));
}

async function postsWithAuthors(posts: Record<string, unknown>[]) {
  const byId = await usersById();
  return posts.map((post) => {
    const author = byId.get(Number(post.userId));
    return {
      ...post,
      authorDisplayName: author?.displayName ?? null,
      authorUsername: author?.username ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
    };
  });
}

interactionsRouter.get("/notifications", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const [rows, byId] = await Promise.all([
      selectRows("notifications", {
        filters: [eq("recipientId", req.userId!)],
        order: { column: "createdAt", ascending: false },
        limit: 100,
      }),
      usersById(),
    ]);
    const notifications = rows.map((notification) => {
      const actor = byId.get(Number(notification.actorId));
      return {
        ...notification,
        actorId: actor?.id ?? notification.actorId,
        actorUsername: actor?.username ?? null,
        actorDisplayName: actor?.displayName ?? null,
        actorAvatarUrl: actor?.avatarUrl ?? null,
      };
    });
    return res.json({ notifications });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.patch("/notifications/read-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    await updateRows("notifications", { read: true }, [eq("recipientId", req.userId!)]);
    return res.json({ ok: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.get("/posts/saved", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const saved = await selectRows("post_saves", {
      filters: [eq("userId", req.userId!)],
      order: { column: "createdAt", ascending: false },
      limit: 100,
    });
    const ids = new Set(saved.map((row) => Number(row.postId)));
    const posts = await selectRows("posts", { limit: 1000 });
    return res.json({ posts: await postsWithAuthors(posts.filter((post) => ids.has(Number(post.id)))) });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.get("/posts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await postsWithAuthors(await selectRows("posts", { filters: [eq("id", postId)], limit: 1 }));
    if (!post) return res.status(404).json({ error: "Post not found" });
    const [like, save] = await Promise.all([
      selectRows("post_likes", { filters: [eq("postId", postId), eq("userId", req.userId!)], limit: 1 }),
      selectRows("post_saves", { filters: [eq("postId", postId), eq("userId", req.userId!)], limit: 1 }),
    ]);
    return res.json({ post, liked: like.length > 0, saved: save.length > 0 });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.post("/posts/:id/like", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  try {
    const filters = [eq("postId", postId), eq("userId", req.userId!)];
    const existing = await selectRows("post_likes", { filters, limit: 1 });
    if (existing.length) await deleteRows("post_likes", filters);
    else await insertRow("post_likes", { postId, userId: req.userId! });
    const likes = await countFor("post_likes", postId);
    await updateRows("posts", { likes }, [eq("id", postId)]);
    if (!existing.length) {
      const [post] = await selectRows("posts", { select: "user_id", filters: [eq("id", postId)], limit: 1 });
      if (post) await notify(Number(post.userId), req.userId!, "like", "liked your post", postId);
    }
    return res.json({ liked: existing.length === 0, likes });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.post("/posts/:id/save", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  try {
    const filters = [eq("postId", postId), eq("userId", req.userId!)];
    const existing = await selectRows("post_saves", { filters, limit: 1 });
    if (existing.length) await deleteRows("post_saves", filters);
    else await insertRow("post_saves", { postId, userId: req.userId! });
    const saves = await countFor("post_saves", postId);
    await updateRows("posts", { saves }, [eq("id", postId)]);
    return res.json({ saved: existing.length === 0, saves });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.get("/posts/:id/comments", authMiddleware, async (req, res) => {
  const postId = parseId(req.params["id"]);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [comments, byId] = await Promise.all([
      selectRows("comments", {
        filters: [eq("postId", postId)],
        order: { column: "createdAt", ascending: false },
        limit: 100,
      }),
      usersById(),
    ]);
    return res.json({
      comments: comments.map((comment) => {
        const user = byId.get(Number(comment.userId));
        return {
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt,
          userId: user?.id ?? comment.userId,
          username: user?.username ?? null,
          displayName: user?.displayName ?? null,
          avatarUrl: user?.avatarUrl ?? null,
        };
      }),
    });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.post("/posts/:id/comments", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = parseId(req.params["id"]);
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  if (!text || text.length > 1000) return res.status(400).json({ error: "Comment must be between 1 and 1000 characters" });
  try {
    const [post] = await selectRows("posts", { select: "user_id", filters: [eq("id", postId)], limit: 1 });
    if (!post) return res.status(404).json({ error: "Post not found" });
    const [settings] = await selectRows("user_settings", { filters: [eq("userId", Number(post.userId))], limit: 1 });
    const permission = String(settings?.commentPermissions ?? settings?.commentPermission ?? "everyone") as any;
    if (!(await canInteract(permission, req.userId!, Number(post.userId)))) return res.status(403).json({ error: "Comments are restricted for this account" });
    const comment = await insertRow("comments", { postId, userId: req.userId!, text });
    const commentCount = (await selectRows("comments", { select: "id", filters: [eq("postId", postId)] })).length;
    await updateRows("posts", { comments: commentCount }, [eq("id", postId)]);
    const [post] = await selectRows("posts", { select: "user_id", filters: [eq("id", postId)], limit: 1 });
    if (post) await notify(Number(post.userId), req.userId!, "comment", "commented on your post", postId);
    return res.status(201).json({ comment });
  } catch (err) {
    return supabaseError(res, err);
  }
});

interactionsRouter.post("/users/:id/follow", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const followingId = parseId(req.params["id"]);
  if (!followingId) return res.status(400).json({ error: "Invalid user id" });
  if (followingId === req.userId) return res.status(400).json({ error: "You cannot follow yourself" });
  try {
    const filters = [eq("followerId", req.userId!), eq("followingId", followingId)];
    const existing = await selectRows("follows", { filters, limit: 1 });
    if (existing.length) await deleteRows("follows", filters);
    else {
      await insertRow("follows", { followerId: req.userId!, followingId });
      await notify(followingId, req.userId!, "follow", "started following you");
    }
    return res.json({ following: existing.length === 0 });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default interactionsRouter;