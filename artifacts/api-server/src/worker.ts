import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import app from "./app";
import { cleanupExpiredStories } from "./jobs/story-cleanup";
import { closeRequestDb, ensureRequestClientConnected, runWithRequestDb } from "@workspace/db";

type WorkerEnv = {
  HYPERDRIVE?: { connectionString?: string };
};

// Cloudflare's documented Express integration expects the Worker module to
// export a concrete fetch handler. Keep this at module scope so Wrangler and
// the Workers runtime can detect it reliably.
app.listen(3000);
const fetchHandler = httpServerHandler({ port: 3000 });

export default {
  fetch: fetchHandler,

  async scheduled() {
    const workerEnv = env as unknown as WorkerEnv;
    const databaseUrl = workerEnv.HYPERDRIVE?.connectionString;

    // Cron runs in the Worker environment, where DATABASE_URL is not a
    // process.env variable. Use the Hyperdrive binding just like HTTP requests.
    if (!databaseUrl) {
      console.error("Yuniko story cleanup skipped: HYPERDRIVE is not configured");
      return;
    }

    try {
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
