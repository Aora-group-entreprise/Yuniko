import { env as cloudflareEnv } from "cloudflare:workers";

type RealtimeNamespace = {
  getByName(name: string): {
    fetch(request: Request): Promise<Response>;
  };
};

const runtimeEnv = cloudflareEnv as unknown as {
  CALL_SIGNAL?: RealtimeNamespace;
};

/**
 * Server-side fan-out. This calls the Durable Object binding directly, so
 * clients cannot forge recipient events by calling a public publish endpoint.
 */
export async function publishRealtimeToUser(
  userId: number,
  event: Record<string, unknown>,
): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) return;
  const namespace = runtimeEnv.CALL_SIGNAL;
  if (!namespace) return;
  const stub = namespace.getByName(`user:${userId}`);
  const response = await stub.fetch(new Request("https://realtime.internal/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }));
  if (!response.ok) {
    throw new Error(`Realtime publish failed (${response.status})`);
  }
}

export async function getRealtimePresence(userId: number): Promise<boolean> {
  if (!Number.isInteger(userId) || userId <= 0) return false;
  const namespace = runtimeEnv.CALL_SIGNAL;
  if (!namespace) return false;
  const stub = namespace.getByName(`user:${userId}`);
  const response = await stub.fetch(new Request("https://realtime.internal/presence"));
  if (!response.ok) return false;
  const result = await response.json() as { online?: boolean };
  return result.online === true;
}
