import { httpServerHandler } from "cloudflare:node";

// Load the Express application lazily so a module-level startup exception does not
// make the whole Worker return Cloudflare 1101 before it can answer requests.
type FetchHandler = (request: Request, env: unknown, ctx: ExecutionContext) => Response | Promise<Response>;
let fetchHandlerPromise: Promise<FetchHandler> | undefined;

async function getFetchHandler(): Promise<FetchHandler> {
  if (!fetchHandlerPromise) {
    fetchHandlerPromise = (async () => {
      const [{ default: app }] = await Promise.all([
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
    try {
      const handler = await getFetchHandler();
      return await handler(request, env, ctx);
    } catch (error) {
      console.error("Yuniko API Worker startup/request failure", error);
      fetchHandlerPromise = undefined;
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Yuniko API startup failed",
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
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
