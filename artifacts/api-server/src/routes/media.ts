import { Router, Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { assertVideoUploadEnabled } from "../infrastructure/video-features";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "../infrastructure/supabase-storage";

const router = Router();
type R = Request & { userId?: number };

router.post("/media/upload", authMiddleware, async (req: R, res) => {
  const dataUrl = String(req.body?.dataUrl ?? "");
  const kind = String(req.body?.kind ?? "image");
  const filename = String(req.body?.filename ?? "upload");

  if (!["image", "audio", "video"].includes(kind)) return res.status(400).json({ error: "Unsupported media kind" });

  if (kind === "video") {
    try {
      assertVideoUploadEnabled();
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403;
      return res.status(statusCode).json({ error: (error as Error).message });
    }
  }

  if (!/^data:[^;]+;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return res.status(400).json({ error: "Invalid media data" });
  const max = kind === "video" ? 35_000_000 : kind === "audio" ? 16_000_000 : 12_000_000;
  if (dataUrl.length > max) return res.status(413).json({ error: "Media file is too large" });
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const allowed = kind === "video" ? /^video\// : kind === "audio" ? /^audio\// : /^image\//;
  if (!allowed.test(mime)) return res.status(415).json({ error: "Unsupported media type" });

  // Persistent media belongs in Supabase Storage, not in PostgreSQL as Base64.
  // Video remains feature-flagged off until the Video feature is activated.
  if (!isSupabaseStorageConfigured()) {
    return res.status(503).json({ error: "Media storage is not configured" });
  }

  try {
    const uploaded = await uploadToSupabaseStorage({
      dataUrl,
      userId: req.userId!,
      filename,
      mimeType: mime,
      kind,
    });
    return res.status(201).json({ url: uploaded.url, path: uploaded.path, bucket: uploaded.bucket, filename, kind, mimeType: mime });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Media storage upload failed" });
  }
});

export default router;
