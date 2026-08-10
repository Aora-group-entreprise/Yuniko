import { Router, Request } from "express";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
type R = Request & { userId?: number };

router.post("/media/upload", authMiddleware, async (req: R, res) => {
  const dataUrl = String(req.body?.dataUrl ?? "");
  const kind = String(req.body?.kind ?? "image");
  const filename = String(req.body?.filename ?? "upload");
  if (!/^data:[^;]+;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return res.status(400).json({ error: "Invalid media data" });
  const max = kind === "video" ? 35_000_000 : kind === "audio" ? 16_000_000 : 12_000_000;
  if (dataUrl.length > max) return res.status(413).json({ error: "Media file is too large" });
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const allowed = kind === "video" ? /^video\// : kind === "audio" ? /^audio\// : /^image\//;
  if (!allowed.test(mime)) return res.status(415).json({ error: "Unsupported media type" });
  return res.status(201).json({ url: dataUrl, filename, kind, mimeType: mime });
});

export default router;
