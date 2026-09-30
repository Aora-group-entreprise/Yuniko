import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, insertRow, selectRows, updateRows, supabaseError } from "../lib/supabase";

const analyticsRouter = Router();

analyticsRouter.post("/analytics/profile/:profileId/view", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const profileId = Number(req.params.profileId);
  const viewerId = Number(req.userId);
  if (!Number.isInteger(profileId) || profileId <= 0 || !Number.isInteger(viewerId) || viewerId <= 0) return res.status(400).json({ error: "Invalid profile id" });
  if (profileId === viewerId) return res.json({ recorded: false });
  try {
    const [profile] = await selectRows("users", { select: "id", filters: [eq("id", profileId)], limit: 1 });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    await insertRow("profile_views", { profileUserId: profileId, viewerUserId: viewerId });
    return res.status(201).json({ recorded: true });
  } catch (err) { return supabaseError(res, err); }
});

analyticsRouter.post("/analytics/post/:postId/impression", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const postId = Number(req.params.postId);
  const viewerId = Number(req.userId);
  if (!Number.isInteger(postId) || postId <= 0 || !Number.isInteger(viewerId) || viewerId <= 0) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await selectRows("posts", { select: "id,userId,views", filters: [eq("id", postId)], limit: 1 });
    if (!post) return res.status(404).json({ error: "Post not found" });
    const [viewer] = await selectRows("users", { select: "id,auth_user_id", filters: [eq("id", viewerId)], limit: 1 });
    const viewerUuid = String(viewer?.authUserId ?? "");
    if (!viewerUuid) return res.json({ recorded: false, reason: "viewer_not_linked" });
    const alreadySeen = await selectRows("seen_posts", { select: "postId", filters: [eq("postId", postId), eq("userId", viewerUuid)], limit: 1 });
    const currentViews = Number(post.views ?? 0);
    await updateRows("posts", { views: currentViews + 1 }, [eq("id", postId)]);
    if (alreadySeen.length === 0) await insertRow("seen_posts", { postId, userId: viewerUuid });
    return res.status(201).json({ recorded: true, views: currentViews + 1, uniqueViewer: alreadySeen.length === 0 });
  } catch (err) { return supabaseError(res, err); }
});

analyticsRouter.get("/analytics/me", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const userId = Number(req.userId);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [profileViews, posts] = await Promise.all([
      selectRows("profile_views", { select: "id,viewer_user_id,created_at", filters: [eq("profileUserId", userId)], limit: 50000 }),
      selectRows("posts", { select: "id,views", filters: [eq("userId", userId)], limit: 500 }),
    ]);
    const seenViewerIds = new Set<string>();
    for (const post of posts) {
      const seen = await selectRows("seen_posts", { select: "userId", filters: [eq("postId", Number(post.id))], limit: 50000 });
      for (const row of seen) if (row.userId) seenViewerIds.add(String(row.userId));
    }
    return res.json({
      profileViews: profileViews.length,
      postImpressions: posts.reduce((sum, post) => sum + Number(post.views ?? 0), 0),
      reach: seenViewerIds.size,
    });
  } catch (err) { return supabaseError(res, err); }
});

export default analyticsRouter;
