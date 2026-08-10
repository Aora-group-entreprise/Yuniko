import { Router, Request } from "express";
import { postsTable, commentsTable, postEngagementsTable, notificationsTable, usersTable } from "@workspace/db/schema";
import { db } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const postsRouter = Router();
type AuthedRequest = Request & { userId?: number };

const INITIAL_COUNTRIES = 3;
const EXPANDED_COUNTRIES = 10;
// Distribution is intentionally based on observable engagement, not a personalized "For You" score.
// Score = likes*10 + shares*5 + comments*3 + floor(views/20).
// Tier 0: initial 3 countries. Tier 1: 10 countries at score >= 30. Tier 2: global at score >= 100.
const EXPAND_SCORE = 30;
const WORLD_SCORE = 100;
const GLOBAL_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
  "Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czechia",
  "Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
  "Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
  "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan",
  "Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
  "Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
  "Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
  "Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

function dbError(res: any, err: unknown) { console.error(err); return res.status(500).json({ error: "Server error" }); }
function parseMediaItems(mediaItems: unknown): string | null { if (!Array.isArray(mediaItems)) return null; const clean = mediaItems.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 10); return clean.length ? JSON.stringify(clean) : null; }
function mediaTypeFor(mediaUrl?: string | null, mediaItems?: string | null, requested?: string) { if (requested && ["image", "video", "carousel", "text"].includes(requested)) return requested; if (mediaItems) return "carousel"; if (!mediaUrl) return "text"; return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl) || mediaUrl.startsWith("data:video") ? "video" : "image"; }
async function engagementFor(userId: number, postId: number) { const [row] = await db.select().from(postEngagementsTable).where(and(eq(postEngagementsTable.userId, userId), eq(postEngagementsTable.postId, postId))).limit(1); return row; }
async function createNotification(userId: number, actorId: number, type: string, postId: number | null, message: string) { if (userId === actorId) return; await db.insert(notificationsTable).values({ userId, actorId, type, postId, message }).catch(() => undefined); }

async function availableCountries(authorCountry: string | null | undefined) {
  const registered = await db.select({ country: usersTable.country }).from(usersTable);
  const registeredSet = new Set(registered.map((row) => row.country?.trim()).filter((country): country is string => Boolean(country)));
  const countries = GLOBAL_COUNTRIES.filter((country) => registeredSet.has(country));
  // Keep the author's country first when it exists. The global registry supplies the complete
  // country universe once enough users exist; registered countries are used for early real-user seeding.
  if (authorCountry?.trim() && countries.includes(authorCountry.trim())) {
    return [authorCountry.trim(), ...countries.filter((country) => country !== authorCountry.trim())];
  }
  return countries;
}

function calculateViralScore(post: { likes: number; shares: number; comments: number; views: number }) {
  return post.likes * 10 + post.shares * 5 + post.comments * 3 + Math.floor(post.views / 20);
}

async function refreshDistribution(postId: number) {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post || !post.isWorldFeed) return post;
  const score = calculateViralScore(post);
  const nextTier = score >= WORLD_SCORE ? 2 : score >= EXPAND_SCORE ? 1 : 0;
  const [author] = await db.select({ country: usersTable.country }).from(usersTable).where(eq(usersTable.id, post.userId)).limit(1);
  const countries = await availableCountries(author?.country);
  let seeded: string[]; try { seeded = JSON.parse(post.distributionCountries || "[]"); if (!Array.isArray(seeded)) seeded = []; } catch { seeded = []; }
  if (nextTier === 0) seeded = countries.slice(0, INITIAL_COUNTRIES);
  else if (nextTier === 1) seeded = countries.slice(0, EXPANDED_COUNTRIES);
  else seeded = GLOBAL_COUNTRIES;
  const [updated] = await db.update(postsTable).set({ viralScore: score, distributionTier: nextTier, distributionCountries: JSON.stringify(seeded), updatedAt: new Date() }).where(eq(postsTable.id, postId)).returning();
  return updated;
}

postsRouter.post("/posts", authMiddleware, async (req: AuthedRequest, res) => {
  const userId = req.userId!; const { caption, mediaUrl, mediaItems, location, hashtags, isWorldFeed, mediaType } = req.body; const serializedMediaItems = parseMediaItems(mediaItems);
  if (!caption?.trim() && !mediaUrl && !serializedMediaItems) return res.status(400).json({ error: "Post text, photo, or video required" });
  try { const [author] = await db.select({ country: usersTable.country }).from(usersTable).where(eq(usersTable.id, userId)).limit(1); const countries = await availableCountries(author?.country); const seedCountries = countries.slice(0, INITIAL_COUNTRIES); const [post] = await db.insert(postsTable).values({ userId, caption: caption?.trim() ?? "", mediaUrl: mediaUrl ?? null, mediaItems: serializedMediaItems, mediaType: mediaTypeFor(mediaUrl, serializedMediaItems, mediaType), location: location?.trim() || null, hashtags: hashtags?.trim() || null, isWorldFeed: isWorldFeed ?? true, distributionTier: 0, distributionCountries: JSON.stringify(seedCountries) }).returning(); return res.status(201).json({ post }); } catch (err) { return dbError(res, err); }
});

postsRouter.get("/posts/feed", authMiddleware, async (req: AuthedRequest, res) => {
  const userId = req.userId!; const cursor = Number(req.query.cursor ?? 0); const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
  try { const [viewer] = await db.select({ country: usersTable.country }).from(usersTable).where(eq(usersTable.id, userId).limit(1));
    const base = db.select({ id: postsTable.id, userId: postsTable.userId, caption: postsTable.caption, mediaUrl: postsTable.mediaUrl, mediaType: postsTable.mediaType, mediaItems: postsTable.mediaItems, location: postsTable.location, hashtags: postsTable.hashtags, isWorldFeed: postsTable.isWorldFeed, likes: postsTable.likes, comments: postsTable.comments, shares: postsTable.shares, saves: postsTable.saves, views: postsTable.views, reports: postsTable.reports, viralScore: postsTable.viralScore, distributionTier: postsTable.distributionTier, distributionCountries: postsTable.distributionCountries, createdAt: postsTable.createdAt, authorDisplayName: usersTable.displayName, authorUsername: usersTable.username, authorAvatarUrl: usersTable.avatarUrl, liked: postEngagementsTable.liked, saved: postEngagementsTable.saved }).from(postsTable).innerJoin(usersTable, eq(postsTable.userId, usersTable.id)).leftJoin(postEngagementsTable, and(eq(postEngagementsTable.postId, postsTable.id), eq(postEngagementsTable.userId, userId)));
    const candidates = cursor > 0 ? await base.where(sql`${postsTable.id} < ${cursor}`).orderBy(desc(postsTable.id)).limit(limit * 5) : await base.orderBy(desc(postsTable.id)).limit(limit * 5);
    const viewerCountry = viewer?.country?.trim(); const visible = candidates.filter((post) => { if (!post.isWorldFeed || post.userId === userId || post.distributionTier >= 2) return true; if (!viewerCountry) return false; try { const countries = JSON.parse(post.distributionCountries || "[]"); return Array.isArray(countries) && countries.includes(viewerCountry); } catch { return false; } }).slice(0, limit);
    return res.json({ posts: visible, nextCursor: visible.length ? visible[visible.length - 1].id : null, hasMore: candidates.length === limit * 5 || visible.length === limit });
  } catch (err) { return dbError(res, err); }
});

postsRouter.patch("/posts/:id", authMiddleware, async (req: AuthedRequest, res) => { const postId = Number(req.params.id); const { caption, location, hashtags } = req.body; try { const [post] = await db.update(postsTable).set({ caption: caption?.trim() ?? "", location: location || null, hashtags: hashtags || null, updatedAt: new Date() }).where(and(eq(postsTable.id, postId), eq(postsTable.userId, req.userId!))).returning(); if (!post) return res.status(404).json({ error: "Post not found" }); return res.json({ post }); } catch (err) { return dbError(res, err); } });
async function toggle(req: AuthedRequest, postId: number, field: "liked" | "saved" | "shared" | "reported") { const ex = await engagementFor(req.userId!, postId); if (!ex) { const [row] = await db.insert(postEngagementsTable).values({ postId, userId: req.userId!, [field]: true, updatedAt: new Date() }).returning(); return { active: true, previous: false, row }; } const active = !ex[field]; const [row] = await db.update(postEngagementsTable).set({ [field]: active, updatedAt: new Date() }).where(eq(postEngagementsTable.id, ex.id)).returning(); return { active, previous: ex[field], row }; }
async function updateEngagementScore(postId: number) { await refreshDistribution(postId).catch(() => undefined); }
postsRouter.post("/posts/:id/like", authMiddleware, async (req: AuthedRequest, res) => { const id = Number(req.params.id); try { const [target] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, id)); if (!target) return res.status(404).json({ error: "Post not found" }); const r = await toggle(req, id, "liked"); const delta = r.active && !r.previous ? 1 : !r.active && r.previous ? -1 : 0; const [post] = await db.update(postsTable).set({ likes: sql`GREATEST(${postsTable.likes}+${delta},0)`, updatedAt: new Date() }).where(eq(postsTable.id, id)).returning(); await updateEngagementScore(id); await createNotification(target.userId, req.userId!, "like", id, "Your post was liked."); return res.json({ active: r.active, post }); } catch (err) { return dbError(res, err); } });
postsRouter.post("/posts/:id/save", authMiddleware, async (req: AuthedRequest, res) => { const id = Number(req.params.id); try { const r = await toggle(req, id, "saved"); const delta = r.active && !r.previous ? 1 : !r.active && r.previous ? -1 : 0; const [post] = await db.update(postsTable).set({ saves: sql`GREATEST(${postsTable.saves}+${delta},0)`, updatedAt: new Date() }).where(eq(postsTable.id, id)).returning(); return res.json({ active: r.active, post }); } catch (err) { return dbError(res, err); } });
postsRouter.post("/posts/:id/share", authMiddleware, async (req: AuthedRequest, res) => { const id = Number(req.params.id); try { const [target] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, id)); if (!target) return res.status(404).json({ error: "Post not found" }); const r = await toggle(req, id, "shared"); const delta = r.active && !r.previous ? 1 : !r.active && r.previous ? -1 : 0; const [post] = await db.update(postsTable).set({ shares: sql`GREATEST(${postsTable.shares}+${delta},0)`, updatedAt: new Date() }).where(eq(postsTable.id, id)).returning(); await updateEngagementScore(id); return res.json({ active: r.active, post }); } catch (err) { return dbError(res, err); } });
postsRouter.post("/posts/:id/report", authMiddleware, async (req: AuthedRequest, res) => { const id = Number(req.params.id); try { const [target] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, id)); if (!target) return res.status(404).json({ error: "Post not found" }); const r = await toggle(req, id, "reported"); const delta = r.active && !r.previous ? 1 : !r.active && r.previous ? -1 : 0; const [post] = await db.update(postsTable).set({ reports: sql`GREATEST(${postsTable.reports}+${delta},0)`, updatedAt: new Date() }).where(eq(postsTable.id, id)).returning(); return res.json({ active: r.active, post }); } catch (err) { return dbError(res, err); } });
postsRouter.post("/posts/:id/view", authMiddleware, async (req: AuthedRequest, res) => { try { const id = Number(req.params.id); await db.update(postsTable).set({ views: sql`${postsTable.views}+1`, updatedAt: new Date() }).where(eq(postsTable.id, id)); await updateEngagementScore(id); return res.json({ viewed: true }); } catch (err) { return dbError(res, err); } });
postsRouter.get("/posts/:id/comments", authMiddleware, async (req, res) => { try { return res.json({ comments: await db.select().from(commentsTable).where(eq(commentsTable.postId, Number(req.params.id))).orderBy(desc(commentsTable.createdAt)).limit(100) }); } catch (err) { return dbError(res, err); } });
postsRouter.post("/posts/:id/comments", authMiddleware, async (req: AuthedRequest, res) => { const postId = Number(req.params.id); const text = String(req.body?.text ?? "").trim(); if (!text) return res.status(400).json({ error: "Comment text required" }); try { const [target] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)); if (!target) return res.status(404).json({ error: "Post not found" }); const [comment] = await db.insert(commentsTable).values({ postId, userId: req.userId!, text }).returning(); await db.update(postsTable).set({ comments: sql`${postsTable.comments}+1`, updatedAt: new Date() }).where(eq(postsTable.id, postId)); await updateEngagementScore(postId); await createNotification(target.userId, req.userId!, "comment", postId, "Your post received a new comment."); return res.status(201).json({ comment }); } catch (err) { return dbError(res, err); } });
postsRouter.delete("/posts/:id", authMiddleware, async (req: AuthedRequest, res) => { try { const [p] = await db.delete(postsTable).where(and(eq(postsTable.id, Number(req.params.id)), eq(postsTable.userId, req.userId!))).returning({ id: postsTable.id }); return p ? res.json({ success: true }) : res.status(404).json({ error: "Post not found" }); } catch (err) { return dbError(res, err); } });
export default postsRouter;
