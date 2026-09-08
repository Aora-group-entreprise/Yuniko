type NodeRequestHandler = (
  port: number,
  request: Request,
) => Response | Promise<Response>;

let nodeRequestHandlerPromise: Promise<NodeRequestHandler> | undefined;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function getNodeRequestHandler(): Promise<NodeRequestHandler> {
  if (!nodeRequestHandlerPromise) {
    nodeRequestHandlerPromise = (async () => {
      const { handleAsNodeRequest } = await import("cloudflare:node");
      const { createServer } = await import("node:http");
      const { default: app } = await import("./app");

      const server = createServer(app);
      server.listen(3000);

      return handleAsNodeRequest as NodeRequestHandler;
    })();
  }
  return nodeRequestHandlerPromise;
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "yuniko-api", worker: "alive" });
    }

    try {
      const handleAsNodeRequest = await getNodeRequestHandler();
      return await handleAsNodeRequest(3000, request);
    } catch (error) {
      console.error("Yuniko API startup/request failure", error);
      nodeRequestHandlerPromise = undefined;
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
