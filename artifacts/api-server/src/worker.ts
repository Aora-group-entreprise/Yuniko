import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import app from "./app";
import { cleanupExpiredStories } from "./jobs/story-cleanup";
import { closeRequestDb, ensureRequestClientConnected, runWithRequestDb } from "@workspace/db";

type WorkerEnv = {
  HYPERDRIVE?: { connectionString?: string };
};

app.listen(3000);
const fetchHandler = httpServerHandler({ port: 3000 });

export default {
  fetch: fetchHandler,

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
