import { env as cloudflareEnv } from "cloudflare:workers";
import { buildPushPayload } from "@block65/webcrypto-web-push";

const runtimeEnv = cloudflareEnv as unknown as Record<string, string | undefined>;
const getEnv = (name: string) => runtimeEnv[name] ?? process.env[name] ?? "";

export async function sendPushToUser(userId: number, payload: { title: string; body?: string; url?: string; tag?: string }): Promise<number> {
  const publicKey = getEnv("VAPID_PUBLIC_KEY");
  const privateKey = getEnv("VAPID_PRIVATE_KEY");
  const subject = getEnv("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) throw new Error("Push notifications are not configured");
  const { selectRows, eq, deleteRows } = await import("./supabase");
  const rows = await selectRows("push_subscriptions", { filters: [eq("userId", userId)], limit: 100 });
  let delivered = 0;
  for (const row of rows) {
    const subscription = { endpoint: String(row.endpoint), expirationTime: null, keys: { p256dh: String(row.p256dh), auth: String(row.auth) } };
    try {
      const request = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 86400, urgency: "high" } }, subscription, { subject, publicKey, privateKey });
      const response = await fetch(subscription.endpoint, request);
      if (response.status === 404 || response.status === 410) {
        await deleteRows("push_subscriptions", [eq("endpoint", subscription.endpoint)]);
      } else if (response.ok) {
        delivered += 1;
      } else {
        console.error("[YUNIKO PUSH] delivery failed", response.status);
      }
    } catch (error) {
      console.error("[YUNIKO PUSH] delivery failed", error);
    }
  }
  return delivered;
}
