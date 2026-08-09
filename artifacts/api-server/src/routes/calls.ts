import { Router, Request } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { callsTable, callSignalsTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";

const callsRouter = Router();
type AuthedRequest = Request & { userId?: number };

callsRouter.post("/calls/session", authMiddleware, async (req: AuthedRequest, res) => {
  const targetUserId = Number(req.body?.targetUserId);
  const kind = req.body?.kind === "video" ? "video" : "voice";
  if (!Number.isInteger(targetUserId) || targetUserId === req.userId) return res.status(400).json({ error: "Invalid target user" });
  const id = `call_${Date.now()}_${req.userId}_${targetUserId}`;
  const [call] = await db.insert(callsTable).values({ id, callerId: req.userId!, targetUserId, kind, status: "ringing" }).returning();
  return res.status(201).json({ call });
});

callsRouter.get("/calls/:id/signals", authMiddleware, async (req: AuthedRequest, res) => {
  const after = Number(req.query.after ?? 0);
  const rows = await db.select().from(callSignalsTable).where(and(eq(callSignalsTable.callId, req.params.id), gt(callSignalsTable.id, Number.isFinite(after) ? after : 0))).orderBy(callSignalsTable.id).limit(100);
  return res.json({ signals: rows });
});

callsRouter.post("/calls/:id/signal", authMiddleware, async (req: AuthedRequest, res) => {
  const signal = req.body?.signal;
  const type = String(req.body?.type ?? "candidate");
  if (!signal) return res.status(400).json({ error: "Signal required" });
  const [call] = await db.select().from(callsTable).where(eq(callsTable.id, req.params.id)).limit(1);
  if (!call || (call.callerId !== req.userId && call.targetUserId !== req.userId)) return res.status(404).json({ error: "Call not found" });
  const [row] = await db.insert(callSignalsTable).values({ callId: req.params.id, senderId: req.userId!, type, payload: JSON.stringify(signal) }).returning();
  return res.status(201).json({ accepted: true, signal: row });
});

callsRouter.patch("/calls/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const status = ["ringing","connecting","active","ended","rejected"].includes(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: "Invalid call status" });
  const [call] = await db.select().from(callsTable).where(eq(callsTable.id, req.params.id)).limit(1);
  if (!call || (call.callerId !== req.userId && call.targetUserId !== req.userId)) return res.status(404).json({ error: "Call not found" });
  const [updated] = await db.update(callsTable).set({ status, startedAt: status === "active" ? new Date() : call.startedAt, endedAt: ["ended","rejected"].includes(status) ? new Date() : call.endedAt }).where(eq(callsTable.id, req.params.id)).returning();
  return res.json({ call: updated });
});

export default callsRouter;
