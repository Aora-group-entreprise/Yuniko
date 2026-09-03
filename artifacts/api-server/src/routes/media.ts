import { Router, Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { assertVideoUploadEnabled } from "../infrastructure/video-features";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "../infrastructure/supabase-storage";
import { rateLimit } from "../middlewares/rate-limit";

const router = Router();
type R = Request & { userId?: number };
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 20, message: "Too many uploads. Please wait a minute." });

router.post("/media/upload", authMiddleware, uploadLimiter, async (req: R, res) => {
  const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
  const kind = typeof req.body?.kind === "string" ? req.body.kind : "image";
  const filename = typeof req.body?.filename === "string" ? req.body.filename : "upload";

  if (!["image", "audio", "video"].includes(kind)) return res.status(400).json({ error: "Unsupported media kind" });
  if (filename.length > 160 || filename.includes("\0")) return res.status(400).json({ error: "Invalid filename" });

  if (kind === "video") {
    try { assertVideoUploadEnabled(); }
    catch (error) { const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403; return res.status(statusCode).json({ error: (error as Error).message }); }
  }

  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match) return res.status(400).json({ error: "Invalid media data" });
  const mime = match[1];
  const encoded = match[2];
  if (!encoded || encoded.length % 4 === 1) return res.status(400).json({ error: "Invalid media data" });

  const max = kind === "video" ? 35_000_000 : kind === "audio" ? 16_000_000 : 12_000_000;
  if (dataUrl.length > max) return res.status(413).json({ error: "Media file is too large" });
  const allowed = kind === "video" ? /^video\// : kind === "audio" ? /^audio\// : /^image\//;
  if (!allowed.test(mime)) return res.status(415).json({ error: "Unsupported media type" });
  if (!isSupabaseStorageConfigured()) return res.status(503).json({ error: "Supabase Storage is not configured" });

  try {
    const uploaded = await uploadToSupabaseStorage({ dataUrl, userId: req.userId!, filename, mimeType: mime, kind });
    return res.status(201).json({ url: uploaded.url, path: uploaded.path, bucket: uploaded.bucket, filename, kind, mimeType: mime });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "";
    if (message === "Media file is too large") return res.status(413).json({ error: message });
    return res.status(502).json({ error: "Supabase Storage upload failed" });
  }
});

export default router;
