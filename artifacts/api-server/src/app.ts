import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    // The web client is deployed separately from the API Workers origin.
    // Reflect the requesting origin so signin/signup work from the browser.
    origin: true,
    credentials: false,
  }),
);
// Posts and stories are currently sent as compressed data URLs by the
// frontend. Express' 100kb default rejects almost every real phone photo.
// Keep the limit bounded while allowing the documented client-side resize.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

export default app;
