import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getSecret(): string {
  const secret = process.env["SESSION_SECRET"]?.trim();
  if (secret) {
    if (process.env["NODE_ENV"] === "production" && secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters in production.");
    return secret;
  }
  if (process.env["NODE_ENV"] === "production") throw new Error("SESSION_SECRET is required in production.");
  return "yuniko-dev-secret-change-in-prod";
}

export interface AuthPayload { userId: number; }
const JWT_ISSUER = "yuniko-api";
const JWT_AUDIENCE = "yuniko-client";
const MAX_TOKEN_LENGTH = 4096;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
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
