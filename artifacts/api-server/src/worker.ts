import { handleAsNodeRequest } from "cloudflare:node";
import { env } from "cloudflare:workers";
import app from "./app";
import { cleanupExpiredStories } from "./jobs/story-cleanup";
import { closeRequestDb, ensureRequestClientConnected, runWithRequestDb } from "@workspace/db";

type WorkerEnv = {
  HYPERDRIVE?: { connectionString?: string };
};

const PORT = 3000;

// Express runs on Cloudflare's Node.js HTTP compatibility layer.
// Use the explicit request bridge so every Worker request is routed to the
// Express server without relying on handler auto-discovery.
app.listen(PORT);

export default {
  async fetch(request: Request) {
    return handleAsNodeRequest(PORT, request);
  },

  async scheduled() {
    const workerEnv = env as unknown as WorkerEnv;
    const databaseUrl = workerEnv.HYPERDRIVE?.connectionString;

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
