import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordRequest } from "./lib/metrics";
import { rateLimit } from "./middlewares/rate-limit";
import { closeRequestDb, ensureRequestClientConnected, runWithRequestDb } from "@workspace/db";

const app: Express = express();

// The API is behind Cloudflare. Trust the forwarded client address so the
// existing rate limiter does not put every visitor into one shared bucket.
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env["NODE_ENV"] === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Hyperdrive owns the database-side pool. Give each Worker request its own
// short-lived pg Client and close it when the response is finished.
app.use((req, res, next) => {
  runWithRequestDb(() => {
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      void closeRequestDb();
    };
    res.once("finish", cleanup);
    res.once("close", cleanup);

    void ensureRequestClientConnected()
      .then(() => next())
      .catch(next);
  });
});

app.use((req, res, next) => {
  const started = performance.now();
  res.on("finish", () => {
    recordRequest(req.method, req.path, res.statusCode, Math.round(performance.now() - started));
  });
  next();
});

const allowedOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    callback(null, allowedOrigins.includes(origin));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));

// Apply the cheap rate limiter before parsing request bodies. Media uploads need a
// larger parser limit while normal API requests stay small to reduce memory abuse.
app.use("/api", rateLimit({ windowMs: 60_000, max: 240 }));
app.use((req, res, next) => {
  const isMediaUpload = req.path === "/api/media/upload" || req.path === "/media/upload";
  return express.json({ limit: isMediaUpload ? "40mb" : "2mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb", parameterLimit: 100 }));
app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  if ((err as { type?: string })?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  res.status(500).json({ error: "Server error" });
});

export default app;
