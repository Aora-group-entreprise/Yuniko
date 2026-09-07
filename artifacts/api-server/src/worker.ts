import { httpServerHandler } from "cloudflare:node";
import app from "./app";
import { cleanupExpiredStories } from "./jobs/story-cleanup";

const server = app.listen(3000);
const fetchHandler = httpServerHandler(server as never);

export default {
  fetch: fetchHandler,
  async scheduled() {
    await cleanupExpiredStories();
  },
};
