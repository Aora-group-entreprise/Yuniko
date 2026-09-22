import { Router } from "express";
import bcrypt from "bcryptjs";
import { authMiddleware, signToken } from "../middlewares/auth";
import { eq, insertRow, publicUser, selectRows, supabaseError, updateRows } from "../lib/supabase";

const authRouter = Router();

// Yuniko owns authentication. Supabase is used only as the persistent data backend.
authRouter.get("/auth/check-username/:username", async (req, res) => {
  const username = (req.params["username"] ?? "").trim().toLowerCase();
  if (!username || username.length < 3) return res.json({ available: false, reason: "too_short" });
  if (!/^[a-z0-9._]+$/.test(username)) return res.json({ available: false, reason: "invalid_chars" });

  try {
    const rows = await selectRows("users", { select: "id", filters: [eq("username", username)], limit: 1 });
    return res.json({ available: rows.length === 0 });
  } catch (err) {
    return supabaseError(res, err);
  }
});

authRouter.post("/auth/register", async (req, res) => {
  const { username, displayName, password, country, countryFlag, age, avatarUrl } = req.body as {
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
    const existing = await selectRows("users", { select: "id", filters: [eq("username", u)], limit: 1 });
    if (existing.length > 0) return res.status(409).json({ error: "Username already taken" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await insertRow("users", {
      username: u,
      displayName: displayName.trim(),
      passwordHash,
      country: country ?? null,
      countryFlag: countryFlag ?? null,
      age: age ?? null,
      avatarUrl: avatarUrl ?? null,
      bio: "",
    });

    const token = signToken(Number(user.id));
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    return supabaseError(res, err);
  }
});

authRouter.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password) return res.status(400).json({ error: "Username and password are required" });

  try {
    const [user] = await selectRows("users", {
      filters: [eq("username", username.trim().toLowerCase())],
      limit: 1,
    });
    if (!user) return res.status(401).json({ error: "Invalid username or password" });
    if (!(await bcrypt.compare(password, String(user.passwordHash)))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    return res.json({ token: signToken(Number(user.id)), user: publicUser(user) });
  } catch (err) {
    return supabaseError(res, err);
  }
});

authRouter.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const [user] = await selectRows("users", { filters: [eq("id", (req as any).userId)], limit: 1 });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(publicUser(user));
  } catch (err) {
    return supabaseError(res, err);
  }
});

authRouter.patch("/auth/me", authMiddleware, async (req, res) => {
  const { displayName, bio, website, country, countryFlag, avatarUrl } = req.body as {
    displayName?: string;
    bio?: string;
    website?: string | null;
    country?: string | null;
    countryFlag?: string | null;
    avatarUrl?: string | null;
  };
  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) {
    const value = displayName.trim();
    if (!value) return res.status(400).json({ error: "Display name cannot be empty" });
    updates.displayName = value;
  }
  if (bio !== undefined) updates.bio = bio;
  if (website !== undefined) updates.website = website || null;
  if (country !== undefined) updates.country = country || null;
  if (countryFlag !== undefined) updates.countryFlag = countryFlag || null;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    const [user] = await updateRows("users", updates, [eq("id", (req as any).userId)]);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(publicUser(user));
  } catch (err) {
    return supabaseError(res, err);
  }
});

authRouter.post("/auth/reset-password", async (req, res) => {
  const { username, newPassword } = req.body as { username?: string; newPassword?: string };
  if (!username?.trim() || !newPassword) return res.status(400).json({ error: "Username and new password are required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const [user] = await selectRows("users", {
      select: "id",
      filters: [eq("username", username.trim().toLowerCase())],
      limit: 1,
    });
    if (!user) return res.status(404).json({ error: "No account found with that username" });
    await updateRows("users", { passwordHash: await bcrypt.hash(newPassword, 12) }, [eq("id", Number(user.id))]);
    return res.json({ success: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default authRouter;