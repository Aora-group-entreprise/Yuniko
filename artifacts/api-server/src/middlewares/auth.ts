import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getSecret(): string {
  return process.env["SESSION_SECRET"] ?? "yuniko-dev-secret-change-in-prod";
}

export interface AuthPayload {
  userId: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getSecret()) as AuthPayload;
    (req as Request & { userId: number }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, getSecret(), { expiresIn: "30d" });
}
