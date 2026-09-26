import express, { type Express } from "express";
import cors from "cors";
import { env as cloudflareEnv } from "cloudflare:workers";
import router from "./routes";

const app: Express = express();
const runtimeEnv = cloudflareEnv as unknown as Record<string, string | undefined>;
const configuredOrigin = String(runtimeEnv["YUNIKO_APP_URL"] ?? process.env["YUNIKO_APP_URL"] ?? "").trim().replace(/\/+$/, "");

app.use(
  cors({
    origin: configuredOrigin || true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

export default app;
