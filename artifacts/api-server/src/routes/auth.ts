import { Router } from "express";
import { env as cloudflareEnv } from "cloudflare:workers";
import bcrypt from "bcryptjs";
import { authMiddleware, clearSessionCookie, setSessionCookie, signToken } from "../middlewares/auth";
import { deleteAuthUser, deleteRows, eq, insertRow, publicUser, selectRows, supabaseError, updateRows } from "../lib/supabase";

const authRouter = Router();
const runtimeEnv = cloudflareEnv as unknown as Record<string, string | undefined>;

async function persistAvatar(userId: number, avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl || !avatarUrl.startsWith("data:image/")) return avatarUrl;
  const match = avatarUrl.match(/^data:(image\\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("Unsupported avatar format");
  const binary = atob(match[2]);
  if (binary.length > 200_000) throw new Error("Avatar is too large");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const supabaseUrl = String(runtimeEnv["SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "").replace(/\\/+$/, "");
  const serviceKey = runtimeEnv["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase storage is not configured");
  const objectPath = `users/${userId}/avatar.jpg`;
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/yuniko-avatars/${objectPath}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "image/jpeg", "x-upsert": "true", "Cache-Control": "3600" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`Avatar upload failed: ${upload.status}`);
  return `${supabaseUrl}/storage/v1/object/public/yuniko-avatars/${objectPath}`;
}


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
    setSessionCookie(res, token);
    return res.status(201).json({ user: publicUser(user) });
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

    const token = signToken(Number(user.id));
    setSessionCookie(res, token);
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return supabaseError(res, err);
  }
});

authRouter.post("/auth/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true });
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
  if (avatarUrl !== undefined) updates.avatarUrl = await persistAvatar(Number((req as any).userId), avatarUrl || null);
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

authRouter.post("/auth/change-password", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new password are required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
  try {
    const [user] = await selectRows("users", { filters: [eq("id", userId)], limit: 1 });
    if (!user || !(await bcrypt.compare(currentPassword, String(user.passwordHash)))) return res.status(401).json({ error: "Current password is incorrect" });
    await updateRows("users", { passwordHash: await bcrypt.hash(newPassword, 12) }, [eq("id", userId)]);
    return res.json({ success: true });
  } catch (err) { return supabaseError(res, err); }
});


authRouter.post("/auth/delete-account", authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { confirmation } = req.body as { confirmation?: string };
  if (confirmation !== "DELETE") return res.status(400).json({ error: "Type DELETE to confirm account deletion" });

  try {
    const [user] = await selectRows("users", { filters: [eq("id", userId)], limit: 1 });
    if (!user) return res.status(404).json({ error: "User not found" });

    const postRows = await selectRows("posts", { select: "id", filters: [eq("userId", userId)] });
    const postIds = postRows.map((r) => Number(r.id));
    for (const postId of postIds) {
      const postFilters = [eq("postId", postId)];
      for (const table of ["post_engagements","post_likes","post_saves","comments","post_edits","post_media","events","likes","saves","shares","post_stats","post_distribution","seen_posts","post_hashtags","post_mentions","post_processing_jobs"]) {
        try { await deleteRows(table, postFilters); } catch {}
      }
    }

    const storyRows = await selectRows("stories", { select: "id", filters: [eq("userId", userId)] });
    for (const story of storyRows) {
      const storyFilters = [eq("storyId", Number(story.id))];
      for (const table of ["story_views","story_reactions","story_replies"]) {
        try { await deleteRows(table, storyFilters); } catch {}
      }
    }

    const memberships = await selectRows("conversation_members", { select: "conversationId", filters: [eq("userId", userId)] });
    for (const member of memberships) {
      const conversationId = Number(member.conversationId);
      try { await deleteRows("messages", [eq("conversationId", conversationId)]); } catch {}
      try { await deleteRows("archived_conversations", [eq("conversationId", conversationId), eq("userId", userId)]); } catch {}
      try { await deleteRows("conversation_members", [eq("conversationId", conversationId), eq("userId", userId)]); } catch {}
      const remaining = await selectRows("conversation_members", { select: "id", filters: [eq("conversationId", conversationId)], limit: 1 });
      if (!remaining.length) {
        try { await deleteRows("messages", [eq("conversationId", conversationId)]); } catch {}
        try { await deleteRows("conversations", [eq("id", conversationId)]); } catch {}
      }
    }

    const calls = await selectRows("calls", { select: "id", filters: [eq("callerId", userId)] });
    const targetCalls = await selectRows("calls", { select: "id", filters: [eq("targetUserId", userId)] });
    for (const call of [...calls, ...targetCalls]) {
      try { await deleteRows("call_signals", [eq("callId", String(call.id))]); } catch {}
      try { await deleteRows("calls", [eq("id", String(call.id))]); } catch {}
    }

    const lives = await selectRows("live_sessions", { select: "id", filters: [eq("hostUserId", userId)] });
    for (const live of lives) {
      try { await deleteRows("live_engagements", [eq("liveId", Number(live.id))]); } catch {}
      try { await deleteRows("live_comments", [eq("liveId", Number(live.id))]); } catch {}
      try { await deleteRows("live_sessions", [eq("id", Number(live.id))]); } catch {}
    }

    const directTables: Array<[string,string]> = [
      ["posts","userId"],["stories","userId"],["comments","userId"],["follows","followerId"],["follows","followingId"],
      ["notifications","recipientId"],["notifications","actorId"],["message_requests","senderId"],["message_requests","recipientId"],
      ["blocked_users","blockerId"],["blocked_users","blockedId"],["archived_conversations","userId"],["story_views","userId"],
      ["story_reactions","userId"],["story_replies","userId"],["calls","callerId"],["calls","targetUserId"],["call_signals","senderId"],
      ["live_engagements","userId"],["live_comments","userId"],["feedback","userId"],["user_settings","userId"],["post_engagements","userId"],
      ["collections","userId"],["user_affinity","userId"],["user_affinity","targetUserId"],["user_topic_affinity","userId"],["likes","userId"],
      ["saves","userId"],["shares","userId"],["notification_preferences","userId"],["verification_requests","userId"],["events","userId"],
      ["seen_posts","userId"],["reports","reporterId"],["login_events","userId"],["notification_settings","userId"],["auth_sessions","userId"],
      ["username_history","userId"],["user_rate_limits","userId"]
    ];
    for (const [table,column] of directTables) {
      try { await deleteRows(table, [eq(column, userId)]); } catch {}
    }

    for (const postId of postIds) {
      try { await deleteRows("posts", [eq("id", postId)]); } catch {}
    }
    try { await deleteRows("users", [eq("id", userId)]); } catch (err) { throw err; }

    const authUserId = typeof user.authUserId === "string" ? user.authUserId : null;
    if (authUserId) await deleteAuthUser(authUserId);

    return res.json({ success: true });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default authRouter;