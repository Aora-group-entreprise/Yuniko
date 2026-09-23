import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getSecret(): string {
  const configured = process.env["SESSION_SECRET"];
  if (configured) return configured;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "yuniko-dev-secret-change-in-prod";
}

export interface AuthPayload {
  userId: number;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string): void {
  const parts = [
    `yuniko_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Max-Age=2592000",
    "Secure",
    "SameSite=None",
  ].filter(Boolean);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response): void {
  const production = process.env["NODE_ENV"] === "production";
  const parts = [
    "yuniko_session=",
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    production ? "Secure" : "",
    production ? "SameSite=None" : "SameSite=Lax",
  ].filter(Boolean);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function getSessionToken(req: Request): string | null {
  return readCookie(req, "yuniko_session") ?? null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = getSessionToken(req) ?? bearer;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, getSecret()) as AuthPayload;
    (req as Request & { userId: number }).userId = payload.userId;
    next();
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: "Session expired or invalid" });
  }
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, getSecret(), { expiresIn: "30d" });
}
