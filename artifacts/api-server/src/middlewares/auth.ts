import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { env } from "cloudflare:workers";

/**
 * Cloudflare Workers does not expose Wrangler vars through process.env.
 * Prefer SESSION_SECRET. If it is missing, derive a stable server-only key
 * from the Hyperdrive connection string. Normalize short configured secrets
 * instead of throwing a 500 during signup/login.
 */
function getSecret(): string {
  const workerEnv = env as Record<string, unknown>;
  const configured = String(workerEnv["SESSION_SECRET"] ?? process.env["SESSION_SECRET"] ?? "").trim();
  if (configured) {
    return configured.length >= 32
      ? configured
      : createHash("sha256").update(`yuniko-jwt-configured-v1:${configured}`).digest("hex");
  }

  const hyperdrive = workerEnv["HYPERDRIVE"] as { connectionString?: string } | undefined;
  const databaseUrl = hyperdrive?.connectionString?.trim();
  if (databaseUrl) {
    return createHash("sha256").update(`yuniko-jwt-v1:${databaseUrl}`).digest("hex");
  }

  if (String(workerEnv["NODE_ENV"] ?? process.env["NODE_ENV"] ?? "development") === "production") {
    throw new Error("JWT signing key is unavailable in production.");
  }
  return "yuniko-dev-secret-change-in-prod";
}

export interface AuthPayload { userId: number; }
const JWT_ISSUER = "yuniko-api";
const JWT_AUDIENCE = "yuniko-client";
const MAX_TOKEN_LENGTH = 4096;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  let token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token && req.headers.accept?.includes("text/event-stream")) {
    const queryToken = typeof req.query.token === "string" ? req.query.token.trim() : "";
    token = queryToken;
  }

  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (token.length > MAX_TOKEN_LENGTH) { res.status(401).json({ error: "Invalid token" }); return; }

  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ["HS256"], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }) as jwt.JwtPayload;
    if (!Number.isSafeInteger(payload.userId) || payload.userId <= 0) { res.status(401).json({ error: "Invalid token" }); return; }
    (req as Request & { userId: number }).userId = payload.userId;
    next();
  } catch { res.status(401).json({ error: "Invalid or expired token" }); }
}

export function signToken(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Cannot sign token for invalid user id.");
  return jwt.sign({ userId }, getSecret(), { algorithm: "HS256", expiresIn: "30d", issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
}
