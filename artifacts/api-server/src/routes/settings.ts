import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, insertRow, selectRows, supabaseError, updateRows } from "../lib/supabase";

const router = Router();
const allowed = new Set(["everyone", "friendsOnly", "onlyMe"]);

function defaults(userId: number) {
  return { userId, privateAccount: false, readReceipts: true, messagePermissions: "everyone", commentPermissions: "everyone", storyPermissions: "friendsOnly", pushNotifications: true, emailNotifications: true, twoFactor: false, clearCacheOnExit: false, deleteWatchedStories: false };
}

router.get("/settings", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  try {
    let [row] = await selectRows("user_settings", { filters: [eq("userId", userId)], limit: 1 });
    if (!row) row = await insertRow("user_settings", defaults(userId));
    return res.json(row);
  } catch (err) { return supabaseError(res, err); }
});

router.patch("/settings", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  const booleans = ["privateAccount","readReceipts","pushNotifications","emailNotifications","twoFactor","clearCacheOnExit","deleteWatchedStories"];
  for (const key of booleans) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return res.status(400).json({ error: key + " must be boolean" });
      updates[key] = body[key];
    }
  }
  const permissions = ["messagePermissions","commentPermissions","storyPermissions"];
  for (const key of permissions) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string" || !allowed.has(body[key] as string)) return res.status(400).json({ error: "Invalid " + key });
      updates[key] = body[key];
    }
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: "No settings to update" });
  updates.updatedAt = new Date();
  try {
    const rows = await updateRows("user_settings", updates, [eq("userId", userId)]);
    if (!rows[0]) { await insertRow("user_settings", { ...defaults(userId), ...updates }); }
    const [fresh] = await selectRows("user_settings", { filters: [eq("userId", userId)], limit: 1 });
    return res.json(fresh);
  } catch (err) { return supabaseError(res, err); }
});

export default router;