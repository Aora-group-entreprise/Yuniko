import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordRequest } from "./lib/metrics";

const app: Express = express();
app.use(pinoHttp({
  logger,
  serializers: {
    req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
}));
app.use((req, res, next) => {
  const started = performance.now();
  res.on("finish", () => {
    recordRequest(req.method, req.path, res.statusCode, Math.round(performance.now() - started));
  });
  next();
});
app.use(cors());
// Media uploads use authenticated base64 data URLs. Keep this limit above the client video limit.
app.use(express.json({ limit: "40mb" }));
app.use(express.urlencoded({ extended: true, limit: "40mb" }));
app.use("/api", router);
export default app;
