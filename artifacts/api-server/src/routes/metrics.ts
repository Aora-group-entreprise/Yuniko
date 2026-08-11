import { Router, type IRouter } from "express";
import { snapshotMetrics } from "../lib/metrics";

const router: IRouter = Router();

router.get("/metrics", (req, res) => {
  const expected = process.env.METRICS_TOKEN;
  if (expected && req.header("x-metrics-token") !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json(snapshotMetrics());
});

export default router;
