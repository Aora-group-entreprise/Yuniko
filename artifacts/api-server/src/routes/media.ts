import { Router, Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { assertVideoUploadEnabled } from "../infrastructure/video-features";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "../infrastructure/supabase-storage";
import { rateLimit } from "../middlewares/rate-limit";

const router = Router();
type R = Request & { userId?: number };
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 20, message: "Too many uploads. Please wait a minute." });
const MAX_UPLOAD_BYTES = 12_000_000;
const ALLOWED_KINDS = new Set(["image", "audio", "video"]);

async function readMultipartFile(req: Request): Promise<{ bytes: Buffer; filename: string; mimeType: string; kind: string } | null> {
  const contentType = String(req.headers["content-type"] ?? "");
  const match = contentType.match(/^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  const boundary = Buffer.from(`--${match[1] ?? match[2]}`);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_UPLOAD_BYTES + 64_000) throw new Error("Media file is too large");
    chunks.push(part);
  }
  const body = Buffer.concat(chunks);
  const start = body.indexOf(Buffer.from("\r\n\r\n"));
  if (start < 0) throw new Error("Invalid multipart body");
  const headerText = body.subarray(0, start).toString("utf8");
  const disposition = headerText.match(/content-disposition:[^\r\n]*name="file"[^\r\n]*/i);
  if (!disposition) throw new Error("Missing media file");
  const filenameMatch = disposition[0].match(/filename="([^"]*)"/i);
  const mimeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
  const filename = (filenameMatch?.[1] ?? "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "upload";
  const mimeType = (mimeMatch?.[1] ?? "").trim().toLowerCase();
  const endMarker = Buffer.concat([Buffer.from("\r\n"), boundary, Buffer.from("--")]);
  const end = body.indexOf(endMarker, start + 4);
  if (end < 0) throw new Error("Invalid multipart body");
  const bytes = body.subarray(start + 4, end);
  if (!bytes.length) throw new Error("Empty media file");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("Media file is too large");
  const kind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "video" : "";
  if (!ALLOWED_KINDS.has(kind)) throw new Error("Unsupported media type");
  return { bytes, filename, mimeType, kind };
}

router.post("/media/upload", authMiddleware, uploadLimiter, async (req: R, res) => {
  try {
    if (!isSupabaseStorageConfigured()) return res.status(503).json({ error: "Supabase Storage is not configured" });

    const isMultipart = String(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/form-data");
    if (isMultipart) {
      const file = await readMultipartFile(req);
      if (!file) return res.status(400).json({ error: "Invalid multipart upload" });
      if (file.kind === "video") {
        try { assertVideoUploadEnabled(); }
        catch (error) { const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403; return res.status(statusCode).json({ error: (error as Error).message }); }
      }
      const dataUrl = `data:${file.mimeType};base64,${file.bytes.toString("base64")}`;
      const uploaded = await uploadToSupabaseStorage({ dataUrl, userId: req.userId!, filename: file.filename, mimeType: file.mimeType, kind: file.kind });
      return res.status(201).json({ url: uploaded.url, path: uploaded.path, bucket: uploaded.bucket, filename: file.filename, kind: file.kind, mimeType: file.mimeType });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "Invalid request body" });
    const unknownKey = Object.keys(req.body).find((key) => !["dataUrl", "kind", "filename"].includes(key));
    if (unknownKey) return res.status(400).json({ error: "Unknown field" });
    const dataUrl = typeof req.body.dataUrl === "string" ? req.body.dataUrl : "";
    const kind = typeof req.body.kind === "string" ? req.body.kind : "image";
    const filename = typeof req.body.filename === "string" ? req.body.filename : "upload";
    if (!ALLOWED_KINDS.has(kind)) return res.status(400).json({ error: "Unsupported media kind" });
    if (filename.length > 160 || filename.includes("\0")) return res.status(400).json({ error: "Invalid filename" });
    if (kind === "video") {
      try { assertVideoUploadEnabled(); }
      catch (error) { const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403; return res.status(statusCode).json({ error: (error as Error).message }); }
    }
    if (!dataUrl || dataUrl.length > 16_000_000) return res.status(413).json({ error: "Media file is too large" });
    const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/]*={0,2})$/);
    if (!match) return res.status(400).json({ error: "Invalid media data" });
    const mime = match[1];
    const encoded = match[2];
    const allowed = kind === "video" ? /^video\// : kind === "audio" ? /^audio\// : /^image\//;
    if (!encoded || encoded.length % 4 === 1) return res.status(400).json({ error: "Invalid media data" });
    if (!allowed.test(mime)) return res.status(415).json({ error: "Unsupported media type" });
    const uploaded = await uploadToSupabaseStorage({ dataUrl, userId: req.userId!, filename, mimeType: mime, kind });
    return res.status(201).json({ url: uploaded.url, path: uploaded.path, bucket: uploaded.bucket, filename, kind, mimeType: mime });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "";
    if (message === "Media file is too large") return res.status(413).json({ error: message });
    if (message === "Media content does not match its declared type") return res.status(415).json({ error: message });
    if (message === "Invalid multipart body" || message === "Missing media file" || message === "Empty media file") return res.status(400).json({ error: message });
    if (message === "Unsupported media type") return res.status(415).json({ error: message });
    if (message === "Invalid media data" || message === "Invalid base64 media") return res.status(400).json({ error: "Invalid media data" });
    return res.status(502).json({ error: "Supabase Storage upload failed" });
  }
});

export default router;
