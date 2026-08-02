import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, signToken } from "../middlewares/auth";

const authRouter = Router();

function dbError(res: any, err: unknown) {
  if (!process.env["DATABASE_URL"]) {
    return res.status(503).json({
      error: "Database not configured. Please provision a database and set DATABASE_URL.",
    });
  }
  console.error(err);
  return res.status(500).json({ error: "Server error" });
}

// GET /api/auth/check-username/:username
authRouter.get("/auth/check-username/:username", async (req, res) => {
  const username = (req.params["username"] ?? "").trim().toLowerCase();
  if (!username || username.length < 3) {
    return res.json({ available: false, reason: "too_short" });
  }
  if (!/^[a-z0-9._]+$/.test(username)) {
    return res.json({ available: false, reason: "invalid_chars" });
  }
  try {
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    return res.json({ available: rows.length === 0 });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/auth/register
authRouter.post("/auth/register", async (req, res) => {
  const { username, displayName, password, country, countryFlag, age, avatarUrl } =
    req.body as {
      username?: string;
      displayName?: string;
      password?: string;
      country?: string;
      countryFlag?: string;
      age?: number;
      avatarUrl?: string | null;
    };

  if (!username?.trim() || !displayName?.trim() || !password) {
    return res.status(400).json({ error: "Username, display name and password are required" });
  }
  const u = username.trim().toLowerCase();
  if (u.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
  if (!/^[a-z0-9._]+$/.test(u)) return res.status(400).json({ error: "Invalid username characters" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (age != null && (age < 13 || age > 120)) return res.status(400).json({ error: "Invalid age" });

  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, u))
      .limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "Username already taken" });

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({
        username: u,
        displayName: displayName.trim(),
        passwordHash,
        country: country ?? null,
        countryFlag: countryFlag ?? null,
        age: age ?? null,
        avatarUrl: avatarUrl ?? null,
        bio: "",
      })
      .returning();

    const token = signToken(user.id);
    const { passwordHash: _, ...publicUser } = user;
    return res.status(201).json({ token, user: publicUser });
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/auth/login
authRouter.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()))
      .limit(1);
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const token = signToken(user.id);
    const { passwordHash: _, ...publicUser } = user;
    return res.json({ token, user: publicUser });
  } catch (err) {
    return dbError(res, err);
  }
});

// GET /api/auth/me
authRouter.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { passwordHash: _, ...publicUser } = user;
    return res.json(publicUser);
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/auth/reset-password
authRouter.post("/auth/reset-password", async (req, res) => {
  const { username, newPassword } = req.body as { username?: string; newPassword?: string };
  if (!username?.trim() || !newPassword) {
    return res.status(400).json({ error: "Username and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()))
      .limit(1);
    if (!user) return res.status(404).json({ error: "No account found with that username" });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, user.id));

    return res.json({ success: true });
  } catch (err) {
    return dbError(res, err);
  }
});

export default authRouter;
