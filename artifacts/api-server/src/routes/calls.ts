import { Router, Request } from "express";
import { authMiddleware } from "../middlewares/auth";

const callsRouter = Router();
type AuthedRequest = Request & { userId?: number };

// Lightweight call-signaling placeholder. Media must still be negotiated with WebRTC on the client.
callsRouter.post("/calls/session", authMiddleware, async (req: AuthedRequest, res) => {
  const targetUserId = Number(req.body?.targetUserId);
  const kind = req.body?.kind === "video" ? "video" : "voice";
  if (!Number.isInteger(targetUserId) || targetUserId === req.userId) return res.status(400).json({ error: "Invalid target user" });
  return res.status(201).json({ call: { id: `call_${Date.now()}_${req.userId}`, callerId: req.userId, targetUserId, kind, status: "ringing", createdAt: new Date().toISOString() } });
});

callsRouter.post("/calls/:id/signal", authMiddleware, async (req: AuthedRequest, res) => {
  const signal = req.body?.signal;
  if (!signal) return res.status(400).json({ error: "Signal required" });
  return res.json({ accepted: true, callId: req.params.id, fromUserId: req.userId, signal });
});

export default callsRouter;
