import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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
import { assertLiveEnabled } from "../infrastructure/video-features";
import { authMiddleware } from "../middlewares/auth";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "../infrastructure/supabase-storage";

const router: IRouter = Router();
type AuthedRequest = Request & { userId?: number };

function liveFeatureGate(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/live")) return next();
  try {
    assertLiveEnabled();
    return next();
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return res.status(statusCode).json({ error: (error as Error).message });
  }
}

async function handleInlineImage(req: AuthedRequest, res: Response, next: NextFunction) {
  const mediaUrl = req.body?.mediaUrl;
  if (typeof mediaUrl !== "string" || !mediaUrl.startsWith("data:image/")) return next();
  if (!req.userId) return res.status(401).json({ error: "Authentication required" });

  // Storage is optional. If it is configured, upload and store the short HTTPS URL.
  // Otherwise keep the compressed data URL so image posts/stories remain functional.
  if (!isSupabaseStorageConfigured()) return next();

  const match = mediaUrl.match(/^data:([^;]+);base64,/);
  if (!match) return res.status(400).json({ error: "Invalid media data" });
  try {
    const uploaded = await uploadToSupabaseStorage({
      dataUrl: mediaUrl,
      userId: req.userId,
      filename: req.path === "/stories" ? "story.jpg" : "post.jpg",
      mimeType: match[1],
      kind: "image",
    });
    req.body.mediaUrl = uploaded.url;
    return next();
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "";
    if (message === "Media file is too large") return res.status(413).json({ error: message });
    if (message === "Media content does not match its declared type") return res.status(415).json({ error: message });
    if (message.includes("Supabase Storage upload failed")) return res.status(502).json({ error: "Supabase Storage upload failed" });
    return res.status(400).json({ error: "Invalid media data" });
  }
}

function inlineImageUpload(req: AuthedRequest, res: Response, next: NextFunction) {
  const isCreateMedia = req.method === "POST" && (req.path === "/posts" || req.path === "/stories");
  if (!isCreateMedia) return next();
  return authMiddleware(req, res, () => { void handleInlineImage(req, res, next); });
}

router.use(healthRouter);
router.use(metricsRouter);
router.use(authRouter);
router.use(inlineImageUpload);
router.use(postsRouter);
router.use(storiesRouter);
router.use(callsRouter);
router.use(socialCompletionRouter);
router.use(platformEnhancementsRouter);
router.use(liveFeatureGate);
router.use(liveStreamRouter);
router.use(mediaRouter);

export default router;
