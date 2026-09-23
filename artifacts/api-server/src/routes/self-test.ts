import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { deleteRows, eq, insertRow, selectRows } from "../lib/supabase";

const router = Router();

function isEnabled(req: { headers: Record<string, string | string[] | undefined> }) {
  const secret = process.env["SELF_TEST_SECRET"];
  if (!secret) return false;
  const supplied = req.headers["x-yuniko-self-test-secret"];
  return supplied === secret;
}

const runSelfTest = async (req: any, res: any) => {
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
      select: "id,username,passwordHash",
      filters: [eq("id", userId)],
      limit: 1,
    });
    result.steps.accountRead = Boolean(stored);
    result.steps.passwordVerify = Boolean(
      stored?.passwordHash && (await bcrypt.compare(password, String(stored.passwordHash))),
    );

    result.ok = Object.values(result.steps)
      .filter((value) => typeof value === "boolean")
      .every(Boolean);
  } catch (err) {
    result.error = err instanceof Error ? err.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]") : String(err);
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
});

export default router;
