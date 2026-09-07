import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordRequest } from "./lib/metrics";
import { rateLimit } from "./middlewares/rate-limit";
import { closeRequestDb, ensureRequestClientConnected, runWithRequestDb } from "@workspace/db";
import { env } from "cloudflare:workers";

const app: Express = express();
const workerEnv = env as Record<string, unknown>;
const nodeEnv = String(workerEnv["NODE_ENV"] ?? process.env["NODE_ENV"] ?? "development");
const allowedOrigins = String(workerEnv["CORS_ORIGINS"] ?? process.env["CORS_ORIGINS"] ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);

app.set("trust proxy", true);
app.disable("x-powered-by");

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    callback(null, allowedOrigins.includes(origin));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (nodeEnv === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Bound long-lived SSE connections per session/IP inside each Worker isolate.
// This complements request rate limiting and prevents one client from opening
// an unbounded number of streams. The frontend authenticates streams via the
// Authorization header, never via a query-string token.
const activeStreams = new Map<string, number>();
const MAX_SSE_CONNECTIONS = 4;
app.use((req, res, next) => {
  if (req.method !== "GET" || req.headers.accept !== "text/event-stream") return next();
  const authorization = req.headers.authorization ?? "";
  const key = authorization.startsWith("Bearer ") ? authorization : `ip:${req.ip ?? "unknown"}`;
  const count = activeStreams.get(key) ?? 0;
  if (count >= MAX_SSE_CONNECTIONS) return res.status(429).json({ error: "Too many realtime connections" });
  activeStreams.set(key, count + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const current = activeStreams.get(key) ?? 1;
    if (current <= 1) activeStreams.delete(key);
    else activeStreams.set(key, current - 1);
  };
  res.once("finish", release);
  res.once("close", release);
  next();
});

app.use((req, res, next) => {
  const hyperdrive = env.HYPERDRIVE as { connectionString?: string } | undefined;
  const databaseUrl = hyperdrive?.connectionString;
  if (!databaseUrl) return res.status(503).json({ error: "Database binding is not configured" });
  runWithRequestDb(() => {
    let closed = false;
    const cleanup = () => { if (closed) return; closed = true; void closeRequestDb(); };
    res.once("finish", cleanup);
    res.once("close", cleanup);
    void ensureRequestClientConnected().then(() => next()).catch(next);
  }, databaseUrl);
});

app.use((req, res, next) => {
  const started = performance.now();
  res.on("finish", () => recordRequest(req.method, req.path, res.statusCode, Math.round(performance.now() - started)));
  next();
});

app.use("/api", rateLimit({ windowMs: 60_000, max: 240 }));
app.use((req, res, next) => {
  const isMediaUpload = req.path === "/api/media/upload" || req.path === "/media/upload";
  return express.json({ limit: isMediaUpload ? "40mb" : "14mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb", parameterLimit: 100 }));
app.use("/api", router);
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  if ((err as { type?: string })?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large" });
  if ((err as { type?: string })?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  res.status(500).json({ error: "Server error" });
});

export default app;
