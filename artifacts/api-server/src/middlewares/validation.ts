import type { Request, Response, NextFunction } from "express";

export function positiveId(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function nonNegativeInt(value: unknown, fallback: number, max: number): number {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return fallback;
  const n = Number(text);
  return Number.isSafeInteger(n) ? Math.min(n, max) : fallback;
}

export function textField(value: unknown, max: number, required = false): string | null {
  if (typeof value !== "string") return required ? null : "";
  const text = value.trim();
  if (!text && required) return null;
  return text.length <= max ? text : null;
}

export function optionalUrl(value: unknown, max = 500): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > max) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateBodyKeys(allowed: readonly string[], req: Request, res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const unknown = Object.keys(req.body).find((key) => !allowed.includes(key));
  if (unknown) {
    res.status(400).json({ error: `Unknown field: ${unknown}` });
    return;
  }
  next();
}
