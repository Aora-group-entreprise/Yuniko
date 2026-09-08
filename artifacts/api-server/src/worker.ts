type FetchHandler = (
  request: Request,
  env: unknown,
  ctx: { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void },
) => Response | Promise<Response>;
let fetchHandlerPromise: Promise<FetchHandler> | undefined;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function getFetchHandler(): Promise<FetchHandler> {
  if (!fetchHandlerPromise) {
    fetchHandlerPromise = (async () => {
      const [{ httpServerHandler }, { createServer }] = await Promise.all([
        import("cloudflare:node"),
        import("node:http"),
      ]);
      const { default: app } = await import("./app");
      const server = createServer(app);
      return httpServerHandler(server) as unknown as FetchHandler;
    })();
  }
  return fetchHandlerPromise;
}

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void },
  ) {
    const url = new URL(request.url);

    // Keep liveness independent from Express, Pino, Drizzle and Hyperdrive.
    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "yuniko-api", worker: "alive" });
    }

    try {
      const handler = await getFetchHandler();
      return await handler(request, env, ctx);
    } catch (error) {
      console.error("Yuniko API startup/request failure", error);
      fetchHandlerPromise = undefined;
      return json(
        {
          ok: false,
          error: "Yuniko API startup failed",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },

  async scheduled() {
    try {
      const { env } = await import("cloudflare:workers");
      const workerEnv = env as unknown as { HYPERDRIVE?: { connectionString?: string } };
      const databaseUrl = workerEnv.HYPERDRIVE?.connectionString;

      if (!databaseUrl) {
        console.error("Yuniko story cleanup skipped: HYPERDRIVE is not configured");
        return;
      }

      const { cleanupExpiredStories } = await import("./jobs/story-cleanup");
      const { closeRequestDb, ensureRequestClientConnected, runWithRequestDb } = await import("@workspace/db");

      await runWithRequestDb(async () => {
        try {
          await ensureRequestClientConnected();
          await cleanupExpiredStories();
        } finally {
          await closeRequestDb();
        }
      }, databaseUrl);
    } catch (error) {
      console.error("Yuniko story cleanup failed", error);
    }
  },
};
