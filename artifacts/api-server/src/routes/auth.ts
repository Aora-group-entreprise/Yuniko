import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, signToken } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rate-limit";

const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, message: "Too many authentication attempts. Please wait a minute." });

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
authRouter.get("/auth/check-username/:username", authLimiter, async (req, res) => {
  const username = (req.params["username"] ?? "").trim().toLowerCase();
  if (!username || username.length < 3) {
    return res.json({ available: false, reason: "too_short" });
  }
  if (username.length > 30 || !/^[a-z0-9._]+$/.test(username)) {
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
authRouter.post("/auth/register", authLimiter, async (req, res) => {
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
  const d = displayName.trim();
  if (u.length < 3 || u.length > 30) return res.status(400).json({ error: "Username must be 3-30 characters" });
  if (!/^[a-z0-9._]+$/.test(u)) return res.status(400).json({ error: "Invalid username characters" });
  if (d.length > 80) return res.status(400).json({ error: "Display name is too long" });
  if (password.length < 6 || password.length > 200) return res.status(400).json({ error: "Password must be 6-200 characters" });
  if (age != null && (!Number.isInteger(age) || age < 13 || age > 120)) return res.status(400).json({ error: "Invalid age" });

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
        displayName: d,
        passwordHash,
        country: country?.slice(0, 80) ?? null,
        countryFlag: countryFlag?.slice(0, 16) ?? null,
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
authRouter.post("/auth/login", authLimiter, async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username.trim().length > 30 || password.length > 200) {
    return res.status(401).json({ error: "Invalid username or password" });
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

// PATCH /api/auth/me — update own profile
authRouter.patch("/auth/me", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { displayName, bio, website, country, countryFlag, avatarUrl } =
    req.body as {
      displayName?: string;
      bio?: string;
      website?: string | null;
      country?: string | null;
      countryFlag?: string | null;
      avatarUrl?: string | null;
    };

  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) {
    if (typeof displayName !== "string") return res.status(400).json({ error: "Invalid display name" });
    const d = displayName.trim();
    if (!d) return res.status(400).json({ error: "Display name cannot be empty" });
    if (d.length > 80) return res.status(400).json({ error: "Display name is too long" });
    updates["displayName"] = d;
  }
  if (bio !== undefined) {
    if (typeof bio !== "string" || bio.length > 2000) return res.status(400).json({ error: "Bio is too long" });
    updates["bio"] = bio;
  }
  if (website !== undefined) {
    if (website !== null && (typeof website !== "string" || website.length > 500)) return res.status(400).json({ error: "Invalid website" });
    updates["website"] = website || null;
  }
  if (country !== undefined) updates["country"] = typeof country === "string" ? country.slice(0, 80) || null : null;
  if (countryFlag !== undefined) updates["countryFlag"] = typeof countryFlag === "string" ? countryFlag.slice(0, 16) || null : null;
  if (avatarUrl !== undefined) updates["avatarUrl"] = avatarUrl || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _, ...publicUser } = user;
    return res.json(publicUser);
  } catch (err) {
    return dbError(res, err);
  }
});

// POST /api/auth/change-password — authenticated password change.
authRouter.post("/auth/change-password", authMiddleware, authLimiter, async (req, res) => {
  const userId = (req as any).userId as number;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new passwords are required" });
  if (newPassword.length < 6 || newPassword.length > 200) return res.status(400).json({ error: "Password must be 6-200 characters" });

  try {
    const [user] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    await db.update(usersTable).set({ passwordHash: await bcrypt.hash(newPassword, 12) }).where(eq(usersTable.id, userId));
    return res.json({ success: true });
  } catch (err) {
    return dbError(res, err);
  }
});

// Password reset without proof of account ownership is intentionally disabled.
authRouter.post("/auth/reset-password", authLimiter, async (_req, res) => {
  return res.status(410).json({ error: "Password reset is temporarily unavailable. Use Change Password while signed in." });
});

export default authRouter;
