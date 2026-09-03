import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 20_000;
let lastCleanup = 0;

export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL_MS || buckets.size > MAX_BUCKETS) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      // A hard cap prevents an attacker from creating unbounded unique IP/path keys.
      if (buckets.size > MAX_BUCKETS) {
        let remove = buckets.size - MAX_BUCKETS;
        for (const key of buckets.keys()) {
          buckets.delete(key);
          if (--remove <= 0) break;
        }
      }
      lastCleanup = now;
    }

    const key = `${req.ip ?? "unknown"}:${req.method}:${req.path}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ error: options.message ?? "Too many requests. Please try again later." });
      return;
    }

    next();
  };
}
