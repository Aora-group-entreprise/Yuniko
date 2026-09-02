import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getSecret(): string {
  const secret = process.env["SESSION_SECRET"]?.trim();
  if (secret) return secret;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return "yuniko-dev-secret-change-in-prod";
}

export interface AuthPayload {
  userId: number;
}

const JWT_ISSUER = "yuniko-api";
const JWT_AUDIENCE = "yuniko-client";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  // Query-string tokens are intentionally not accepted: they can leak into logs,
  // browser history and proxy telemetry. Use Authorization: Bearer instead.
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;

    if (!Number.isSafeInteger(payload.userId) || payload.userId <= 0) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    (req as Request & { userId: number }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Cannot sign token for invalid user id.");
  }

  return jwt.sign({ userId }, getSecret(), {
    algorithm: "HS256",
    expiresIn: "30d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}
