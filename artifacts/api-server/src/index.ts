import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"]?.trim();
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");

const port = Number(rawPort);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down server");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error while closing server");
      process.exitCode = 1;
    }
    process.exit();
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
