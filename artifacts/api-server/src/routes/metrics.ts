import { Router, type IRouter } from "express";
import { env } from "cloudflare:workers";
import { snapshotMetrics } from "../lib/metrics";

const router: IRouter = Router();

router.get("/metrics", (req, res) => {
  const workerEnv = env as Record<string, unknown>;
  const production = String(workerEnv["NODE_ENV"] ?? process.env["NODE_ENV"] ?? "development") === "production";
  const expected = String(workerEnv["METRICS_TOKEN"] ?? process.env["METRICS_TOKEN"] ?? "").trim();
  if (production && !expected) return res.status(404).json({ error: "Not found" });
  if (expected && req.header("x-metrics-token") !== expected) return res.status(401).json({ error: "Unauthorized" });
  return res.json(snapshotMetrics());
});

export default router;
