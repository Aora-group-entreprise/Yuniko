import type { NextFunction, Request, Response } from "express";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "../infrastructure/supabase-storage";

type MediaRequest = Request & { userId?: number };

/**
 * The create screen currently sends the selected image as a data URL.
 * Persisting that data URL directly in posts/stories is fragile because the
 * database rows then contain large blobs and stories have a small URL limit.
 *
 * Convert only those create requests to a Supabase Storage URL before the
 * existing post/story routes run. Other API requests are left untouched.
 */
export async function uploadCreateMedia(req: MediaRequest, res: Response, next: NextFunction) {
  if (req.method !== "POST" || (req.path !== "/api/posts" && req.path !== "/api/stories")) return next();

  const body = req.body as Record<string, unknown> | undefined;
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  if (!mediaUrl.startsWith("data:image/")) return next();

  if (!req.userId || !isSupabaseStorageConfigured()) {
    return res.status(503).json({ error: "Supabase Storage is not configured" });
  }

  const match = mediaUrl.match(/^data:(image\/[^;]+);base64,/i);
  if (!match) return res.status(400).json({ error: "Invalid image data" });

  try {
    const mimeType = match[1].toLowerCase();
    const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const uploaded = await uploadToSupabaseStorage({
      dataUrl: mediaUrl,
      userId: req.userId,
      filename: `upload.${extension}`,
      mimeType,
      kind: "image",
    });

    req.body = { ...body, mediaUrl: uploaded.url, mediaType: "image" };
    return next();
  } catch (error) {
    console.error("Create media upload failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message === "Media file is too large") return res.status(413).json({ error: message });
    if (message === "Media content does not match its declared type") return res.status(415).json({ error: "Invalid image data" });
    if (message === "Invalid media data" || message === "Invalid base64 media" || message === "Empty media file") {
      return res.status(400).json({ error: "Invalid image data" });
    }
    return res.status(502).json({ error: "Image upload failed" });
  }
}
