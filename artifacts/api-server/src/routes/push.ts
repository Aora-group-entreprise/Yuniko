import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { deleteRows, eq, insertRow, selectRows, supabaseError, updateRows } from "../lib/supabase";
import { sendPushToUser } from "../lib/web-push";

const pushRouter = Router();
type AuthenticatedRequest = Request & { userId?: number };

function validSubscription(value: unknown): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object") return false;
  const input = value as any;
  return typeof input.endpoint === "string" && input.endpoint.startsWith("https://") &&
    typeof input.keys?.p256dh === "string" && typeof input.keys?.auth === "string" &&
    input.endpoint.length <= 2048 && input.keys.p256dh.length <= 256 && input.keys.auth.length <= 256;
}

pushRouter.get("/push/vapid-public-key", (_req, res) => {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  if (!publicKey) return res.status(503).json({ error: "Push notifications are not configured" });
  return res.json({ publicKey });
});

pushRouter.post("/push/subscribe", authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!validSubscription(req.body)) return res.status(400).json({ error: "Invalid push subscription" });
  try {
    const { endpoint, keys } = req.body;
    const filters = [eq("endpoint", endpoint)];
    const existing = await selectRows("push_subscriptions", { filters, limit: 1 });
    if (existing.length) {
      await updateRows("push_subscriptions", {
        userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth, updatedAt: new Date(),
      }, filters);
    } else {
      await insertRow("push_subscriptions", {
        userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    return res.status(201).json({ subscribed: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

pushRouter.delete("/push/subscribe", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (!endpoint) return res.status(400).json({ error: "Endpoint required" });
  try {
    await deleteRows("push_subscriptions", [eq("userId", req.userId!), eq("endpoint", endpoint)]);
    return res.json({ unsubscribed: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

pushRouter.post("/push/mobile/register", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const platform = typeof req.body?.platform === "string" ? req.body.platform.trim() : "android";
  if (!token || token.length > 4096) return res.status(400).json({ error: "Invalid mobile push token" });
  try {
    const filters = [eq("token", token)];
    const existing = await selectRows("mobile_push_tokens", { filters, limit: 1 });
    if (existing.length) {
      await updateRows("mobile_push_tokens", {
        userId: req.userId!, platform, updatedAt: new Date(),
      }, filters);
    } else {
      await insertRow("mobile_push_tokens", {
        userId: req.userId!, token, platform,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    return res.status(201).json({ registered: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

pushRouter.delete("/push/mobile/register", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token) return res.status(400).json({ error: "Token required" });
  try {
    await deleteRows("mobile_push_tokens", [eq("userId", req.userId!), eq("token", token)]);
    return res.json({ unregistered: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

pushRouter.post("/push/test", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const delivered = await sendPushToUser(Number(req.userId), {
      title: "Yuniko", body: "Les notifications push sont activées.",
      url: "/notifications", tag: "yuniko-test",
    });
    return res.json({ delivered });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default pushRouter;
