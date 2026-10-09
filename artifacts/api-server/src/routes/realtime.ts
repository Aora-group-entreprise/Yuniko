import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, selectRows, supabaseError } from "../lib/supabase";
import { publishRealtimeToUser } from "../lib/realtime";

const router = Router();

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
