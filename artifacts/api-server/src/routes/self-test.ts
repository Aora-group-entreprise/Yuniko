import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { deleteRows, eq, insertRow, selectRows } from "../lib/supabase";
import { setSessionCookie, signToken } from "../middlewares/auth";

const router = Router();

function getSecretFromQuery(req: any): string {
  return typeof req.query?.secret === "string" ? req.query.secret : "";
}

function isEnabled(req: any): boolean {
  const secret = process.env["SELF_TEST_SECRET"];
  if (!secret) return false;
  const supplied =
    typeof req.headers["x-yuniko-self-test-secret"] === "string"
      ? req.headers["x-yuniko-self-test-secret"]
      : getSecretFromQuery(req);
  return supplied === secret;
}

async function runSelfTest(req: any, res: any) {
  if (!isEnabled(req)) return res.status(404).json({ error: "Not found" });

  const suffix = randomUUID().replace(/-/g, "").slice(0, 16);
  const username = `__yuniko_test_${suffix}`;
  const password = `Test_${suffix}_2026!`;
  let userId: number | null = null;

  const result = {
    ok: false,
    username,
    steps: {
      supabaseRead: false,
      accountCreate: false,
      accountRead: false,
      passwordHash: false,
      passwordVerify: false,
      sessionToken: false,
      sessionVerify: false,
      sessionCookie: false,
      cleanup: false,
    },
    error: null as string | null,
  };

  try {
    await selectRows("users", { select: "id", limit: 1 });
    result.steps.supabaseRead = true;

    const passwordHash = await bcrypt.hash(password, 12);
    result.steps.passwordHash = Boolean(passwordHash);

    const user = await insertRow("users", {
      username,
      displayName: "Yuniko automated test",
      passwordHash,
      country: null,
      countryFlag: null,
      age: 17,
      avatarUrl: null,
      bio: "",
    });
    userId = Number(user.id);
    result.steps.accountCreate = Number.isFinite(userId);

    const [stored] = await selectRows("users", {
      select: "id,username,password_hash",
      filters: [eq("id", userId)],
      limit: 1,
    });
    result.steps.accountRead = Boolean(stored);
    result.steps.passwordVerify = Boolean(
      stored?.passwordHash && (await bcrypt.compare(password, String(stored.passwordHash))),
    );

    const token = signToken(userId);
    result.steps.sessionToken = Boolean(token);
    const payload = jwt.verify(token, process.env["SESSION_SECRET"] ?? "yuniko-dev-secret-change-in-prod") as { userId?: number };
    result.steps.sessionVerify = payload.userId === userId;

    const cookieResponse = {
      headers: new Map<string, string>(),
      setHeader(name: string, value: string) {
        this.headers.set(name, value);
      },
    };
    setSessionCookie(cookieResponse as any, token);
    result.steps.sessionCookie = cookieResponse.headers.has("Set-Cookie");
  } catch (err) {
    result.error =
      err instanceof Error
        ? err.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        : String(err);
  } finally {
    if (userId !== null) {
      try {
        await deleteRows("users", [eq("id", userId)]);
        result.steps.cleanup = true;
      } catch (err) {
        result.error ??= err instanceof Error ? err.message : String(err);
      }
    }
  }

  return res.status(result.ok && result.steps.cleanup ? 200 : 503).json(result);
}

router.post("/debug/self-test", runSelfTest);

router.get("/debug/self-test", runSelfTest);

export default router;
