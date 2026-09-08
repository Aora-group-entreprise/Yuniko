type FetchHandler = (request: Request, env: unknown, ctx: ExecutionContext) => Response | Promise<Response>;
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
      // Keep both imports out of module scope. A failure in Express, Node
      // compatibility, or one of its dependencies must not prevent the Worker
      // from starting and answering /api/health.
      const [{ httpServerHandler }, { default: app }] = await Promise.all([
        import("cloudflare:node"),
        import("./app"),
      ]);

      app.listen(3000);
      return httpServerHandler({ port: 3000 }) as unknown as FetchHandler;
    })();
  }
  return fetchHandlerPromise;
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Diagnostic/liveness endpoint. It intentionally does not import Express,
    // the database client, Drizzle, or any application dependency.
    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "yuniko-api", worker: "alive" });
    }

    try {
      const handler = await getFetchHandler();
      return await handler(request, env, ctx);
    } catch (error) {
      console.error("Yuniko API Worker startup/request failure", error);
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
      const { cleanupExpiredStories } = await import("./jobs/story-cleanup");
      await cleanupExpiredStories();
    } catch (error) {
      console.error("Yuniko story cleanup failed", error);
    }
  },
};
