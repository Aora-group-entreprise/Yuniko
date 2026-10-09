import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, selectRows, supabaseError } from "../lib/supabase";
import { getRealtimePresence, publishRealtimeToUser } from "../lib/realtime";

const router = Router();

router.get("/realtime/presence", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const userId = Number(req.userId);
  const targetId = Number(req.query.userId);
  if (!Number.isInteger(targetId) || targetId <= 0 || targetId === userId) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    const follows = await selectRows("follows", { limit: 5000 });
    const mutual = follows.some((row) => Number(row.followerId) === userId && Number(row.followingId) === targetId) &&
      follows.some((row) => Number(row.followerId) === targetId && Number(row.followingId) === userId);
    if (!mutual) return res.status(403).json({ error: "Presence is available to friends only" });
    return res.json({ online: await getRealtimePresence(targetId) });
  } catch (error) {
    return supabaseError(res, error);
  }
});

router.post("/realtime/presence", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const userId = Number(req.userId);
  if (typeof req.body?.online !== "boolean") {
    return res.status(400).json({ error: "online must be boolean" });
  }
  try {
    const follows = await selectRows("follows", { limit: 5000 });
    const following = new Set(
      follows.filter((row) => Number(row.followerId) === userId).map((row) => Number(row.followingId)),
    );
    const friends = new Set(
      follows
        .filter((row) => Number(row.followingId) === userId && following.has(Number(row.followerId)))
        .map((row) => Number(row.followerId)),
    );
    const online = req.body.online;
    await Promise.all([...friends].map((friendId) =>
      publishRealtimeToUser(friendId, { type: "presence:update", userId, online }).catch((error) => {
        console.error("[YUNIKO REALTIME] presence dispatch failed", error);
      }),
    ));
    return res.json({ updated: true });
  } catch (error) {
    return supabaseError(res, error);
  }
});

export default router;
