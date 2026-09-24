import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { deleteRows, eq, gt, selectRows, sortRows, supabaseError, insertRow } from "../lib/supabase";
import { canInteract } from "../lib/privacy";

const storiesRouter = Router();

async function withAuthors(stories: Record<string, unknown>[]) {
  const users = await selectRows("users", { limit: 1000 });
  const byId = new Map(users.map((user) => [Number(user.id), user]));
  return stories.map((story) => {
    const author = byId.get(Number(story.userId));
    return {
      ...story,
      authorDisplayName: author?.displayName ?? null,
      authorUsername: author?.username ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
    };
  });
}

storiesRouter.post("/stories", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const { mediaUrl, caption } = req.body as { mediaUrl?: string; caption?: string };
  if (!mediaUrl) return res.status(400).json({ error: "Photo required for story" });
  try {
    const story = await insertRow("stories", {
      userId: req.userId!,
      mediaUrl,
      caption: caption?.trim() ?? "",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    return res.status(201).json({ story });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.get("/stories", authMiddleware, async (req: Request & { userId?: number }, res) => {
  try {
    const rows = await selectRows("stories", {
      filters: [gt("expiresAt", new Date())],
      order: { column: "createdAt", ascending: false },
      limit: 30,
    });
    const settings = await selectRows("user_settings", { limit: 1000 });
    const follows = await selectRows("follows", { filters: [eq("followerId", req.userId!)], limit: 5000 });
    const settingsById = new Map(settings.map(r => [Number(r.userId), r]));
    const followingIds = new Set(follows.map(r => Number(r.followingId)));
    const viewerSettings = settingsById.get(Number(req.userId!));
    let visible = rows.filter(story => {
      const owner = Number(story.userId);
      const setting = settingsById.get(owner);
      const privateAccount = Boolean(setting?.privateAccount);
      const permission = String(setting?.storyPermissions ?? setting?.storyPermission ?? "friendsOnly") as any;
      const accountVisible = !privateAccount || owner === req.userId || followingIds.has(owner);
      return accountVisible && (owner === req.userId || permission === "everyone" || (permission === "friendsOnly" && followingIds.has(owner)));
    });
    if (viewerSettings?.deleteWatchedStories === true && visible.length) {
      const views = await selectRows("story_views", { filters: [eq("userId", req.userId!)], limit: 5000 });
      const viewedIds = new Set(views.map(view => Number(view.storyId)));
      visible = visible.filter(story => Number(story.userId) === req.userId || !viewedIds.has(Number(story.id)));
    }
    return res.json({ stories: await withAuthors(visible) });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.post("/stories/:id/view", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid story id" });

  try {
    const [story] = await selectRows("stories", { filters: [eq("id", id)], limit: 1 });
    if (!story) return res.status(404).json({ error: "Story not found" });

    const viewerId = req.userId!;
    if (Number(story.userId) !== viewerId) {
      const [settings] = await selectRows("user_settings", {
        filters: [eq("userId", viewerId)],
        limit: 1,
      });
      await insertRow("story_views", {
        storyId: id,
        userId: viewerId,
        viewedAt: new Date(),
      });

      if (settings?.deleteWatchedStories === true) {
        // Remove it only from this viewer's feed. Never delete the author's story
        // globally just because one viewer enabled auto-delete.
        return res.json({ viewed: true, deleted: false, hiddenForViewer: true });
      }
    }

    return res.json({ viewed: true, deleted: false });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.get("/stories/:id", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid story id" });
  try {
    const [story] = await selectRows("stories", { filters: [eq("id", id)], limit: 1 });
    const expiresAt = story?.expiresAt instanceof Date ? story.expiresAt : new Date(String(story?.expiresAt));
    if (!story || expiresAt.getTime() <= Date.now()) {
      return res.status(404).json({ error: "Story not found or expired" });
    }
    const [settings] = await selectRows("user_settings", { filters: [eq("userId", Number(story.userId))], limit: 1 });
    if (Number(story.userId) !== req.userId) {
      const follows = await selectRows("follows", { filters: [eq("followerId", req.userId!), eq("followingId", Number(story.userId))], limit: 1 });
      const privateAccount = Boolean(settings?.privateAccount);
      const permission = String(settings?.storyPermissions ?? settings?.storyPermission ?? "friendsOnly") as any;
      if ((privateAccount && !follows.length) || !(await canInteract(permission, req.userId!, Number(story.userId)))) {
        return res.status(403).json({ error: "Story is private" });
      }
    }
    return res.json({ story: (await withAuthors([story]))[0] });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default storiesRouter;