import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(
  cors({
    // The web client is deployed separately from the API Workers origin.
    // Cookies are the browser-managed authentication session.
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

export default app;
