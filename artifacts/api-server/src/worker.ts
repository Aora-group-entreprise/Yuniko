import { httpServerHandler } from "cloudflare:node";
import app from "./app";
import { cleanupExpiredStories } from "./jobs/story-cleanup";

app.listen(3000);
const fetchHandler = httpServerHandler({ port: 3000 });

export default {
  fetch: fetchHandler,
  async scheduled() {
    await cleanupExpiredStories();
  },
};
