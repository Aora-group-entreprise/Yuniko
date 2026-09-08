import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { commentsTable, notificationsTable, postsTable, usersTable } from "@workspace/db/schema";
import healthRouter from "./health";
import metricsRouter from "./metrics";
import authRouter from "./auth";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import callsRouter from "./calls";
import socialRouter from "./social";
import socialCompletionRouter from "./social-completion";
import platformEnhancementsRouter from "./platform-enhancements";
import liveStreamRouter from "./live-stream";
import mediaRouter from "./media";
import unreadRouter from "./unread";
import verificationRouter from "./verification";
import { assertLiveEnabled } from "../infrastructure/video-features";
import { authMiddleware } from "../middlewares/auth";
import { positiveId, textField } from "../middlewares/validation";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "../infrastructure/supabase-storage";

const router: IRouter = Router();
type AuthedRequest = Request & { userId?: number };

function liveFeatureGate(req: Request, res: Response, next: NextFunction) { if (!req.path.startsWith("/live")) return next(); try { assertLiveEnabled(); return next(); } catch (error) { const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403; return res.status(statusCode).json({ error: (error as Error).message }); } }
async function handleInlineImage(req: AuthedRequest, res: Response, next: NextFunction) { const mediaUrl = req.body?.mediaUrl; if (typeof mediaUrl !== "string" || !mediaUrl.startsWith("data:image/")) return next(); if (!req.userId) return res.status(401).json({ error: "Authentication required" }); if (!isSupabaseStorageConfigured()) return next(); const match = mediaUrl.match(/^data:([^;]+);base64,/); if (!match) return res.status(400).json({ error: "Invalid media data" }); try { const uploaded = await uploadToSupabaseStorage({ dataUrl: mediaUrl, userId: req.userId, filename: req.path === "/stories" ? "story.jpg" : "post.jpg", mimeType: match[1], kind: "image" }); req.body.mediaUrl = uploaded.url; return next(); } catch (error) { console.error(error); const message = error instanceof Error ? error.message : ""; if (message === "Media file is too large") return res.status(413).json({ error: message }); if (message === "Media content does not match its declared type") return res.status(415).json({ error: message }); if (message.includes("Supabase Storage upload failed")) return res.status(502).json({ error: "Supabase Storage upload failed" }); return res.status(400).json({ error: "Invalid media data" }); } }
function inlineImageUpload(req: AuthedRequest, res: Response, next: NextFunction) { const isCreateMedia = req.method === "POST" && (req.path === "/posts" || req.path === "/stories"); if (!isCreateMedia) return next(); return authMiddleware(req, res, () => { void handleInlineImage(req, res, next); }); }

// Return comments together with the real author's profile. This middleware is
// intentionally mounted before postsRouter so the generic comment routes in
// that router cannot return raw user IDs without profile information.
router.use("/posts/:id/comments", authMiddleware, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const postId = positiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });
  try {
    const [post] = await db.select({ id: postsTable.id, userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (req.method === "GET") {
      const comments = await db.select({
        id: commentsTable.id,
        text: commentsTable.text,
        createdAt: commentsTable.createdAt,
        userId: commentsTable.userId,
        authorDisplayName: usersTable.displayName,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
      }).from(commentsTable)
        .innerJoin(usersTable, eq(usersTable.id, commentsTable.userId))
        .where(eq(commentsTable.postId, postId))
        .orderBy(desc(commentsTable.createdAt))
        .limit(100);
      return res.json({ comments });
    }

    if (req.method === "POST") {
      const text = textField(req.body?.text, 2000, true);
      if (text === null) return res.status(400).json({ error: "Comment text is required and must be 2000 characters or less" });
      const [comment] = await db.insert(commentsTable).values({ postId, userId: req.userId!, text }).returning();
      await db.update(postsTable).set({ comments: sql`${postsTable.comments}+1` }).where(eq(postsTable.id, postId));
      if (post.userId !== req.userId) await db.insert(notificationsTable).values({ userId: post.userId, actorId: req.userId!, type: "comment", postId, message: "Your post received a new comment." }).catch(() => undefined);
      const [author] = await db.select({ displayName: usersTable.displayName, username: usersTable.username, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      return res.status(201).json({ comment: { ...comment, authorDisplayName: author?.displayName ?? "", authorUsername: author?.username ?? "", authorAvatarUrl: author?.avatarUrl ?? null } });
    }
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.use(healthRouter);
router.use(metricsRouter);
router.use(authRouter);
router.use(unreadRouter);
router.use(verificationRouter);
router.use(inlineImageUpload);
router.use(postsRouter);
router.use(storiesRouter);
router.use(socialRouter);
router.use(callsRouter);
router.use(socialCompletionRouter);
router.use(platformEnhancementsRouter);
router.use(liveFeatureGate);
router.use(liveStreamRouter);
router.use(mediaRouter);
export default router;
