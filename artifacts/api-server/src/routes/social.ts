import { Router, Request } from "express";
import { db } from "@workspace/db";
import { usersTable, postsTable, postEngagementsTable, followsTable, notificationsTable, conversationsTable, conversationMembersTable, messagesTable } from "@workspace/db/schema";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const socialRouter = Router();
type AuthedRequest = Request & { userId?: number };
const dbError = (res: any, err: unknown) => { console.error(err); return res.status(500).json({ error: "Server error" }); };
const publicUser = { id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, country: usersTable.country, countryFlag: usersTable.countryFlag, age: usersTable.age, avatarUrl: usersTable.avatarUrl, bio: usersTable.bio, website: usersTable.website, createdAt: usersTable.createdAt };
async function notify(userId: number, actorId: number, type: string, message: string) { if (userId !== actorId) await db.insert(notificationsTable).values({ userId, actorId, type, message }).catch(() => undefined); }

socialRouter.get("/users/search", authMiddleware, async (req: AuthedRequest, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ users: [], posts: [] });
  try {
    const users = await db.select(publicUser).from(usersTable).where(and(ne(usersTable.id, req.userId!), or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`)))).limit(25);
    const posts = await db.select({ id: postsTable.id, userId: postsTable.userId, caption: postsTable.caption, mediaUrl: postsTable.mediaUrl, mediaType: postsTable.mediaType, likes: postsTable.likes, comments: postsTable.comments, createdAt: postsTable.createdAt }).from(postsTable).where(or(ilike(postsTable.caption, `%${q}%`), ilike(postsTable.hashtags, `%${q}%`))).orderBy(desc(postsTable.createdAt)).limit(25);
    return res.json({ users, posts });
  } catch (err) { return dbError(res, err); }
});

socialRouter.get("/users/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid user id" });
  try {
    const [user] = await db.select(publicUser).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const [[followers], [following], [postCount], [isFollowing]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followerId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(postsTable).where(eq(postsTable.userId, id)),
      db.select({ id: followsTable.id }).from(followsTable).where(and(eq(followsTable.followerId, req.userId!), eq(followsTable.followingId, id))).limit(1),
    ]);
    const posts = await db.select().from(postsTable).where(eq(postsTable.userId, id)).orderBy(desc(postsTable.createdAt)).limit(60);
    return res.json({ user: { ...user, followers: followers?.count ?? 0, following: following?.count ?? 0, posts: postCount?.count ?? 0, isFollowing: Boolean(isFollowing) }, posts });
  } catch (err) { return dbError(res, err); }
});

socialRouter.post("/users/:id/follow", authMiddleware, async (req: AuthedRequest, res) => {
  const followingId = Number(req.params.id); if (!Number.isInteger(followingId) || followingId === req.userId) return res.status(400).json({ error: "Invalid user id" });
  try { await db.insert(followsTable).values({ followerId: req.userId!, followingId }).onConflictDoNothing(); await notify(followingId, req.userId!, "follow", "You have a new follower."); return res.json({ following: true }); } catch (err) { return dbError(res, err); }
});
socialRouter.delete("/users/:id/follow", authMiddleware, async (req: AuthedRequest, res) => {
  const followingId = Number(req.params.id); if (!Number.isInteger(followingId)) return res.status(400).json({ error: "Invalid user id" });
  try { await db.delete(followsTable).where(and(eq(followsTable.followerId, req.userId!), eq(followsTable.followingId, followingId))); return res.json({ following: false }); } catch (err) { return dbError(res, err); }
});

socialRouter.get("/notifications", authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const notifications = await db.select({
      id: notificationsTable.id, type: notificationsTable.type, postId: notificationsTable.postId, storyId: notificationsTable.storyId,
      message: notificationsTable.message, readAt: notificationsTable.readAt, createdAt: notificationsTable.createdAt,
      actorId: usersTable.id, actorDisplayName: usersTable.displayName, actorUsername: usersTable.username, actorAvatarUrl: usersTable.avatarUrl,
    }).from(notificationsTable).leftJoin(usersTable, eq(notificationsTable.actorId, usersTable.id))
      .where(eq(notificationsTable.userId, req.userId!)).orderBy(desc(notificationsTable.createdAt)).limit(50);
    return res.json({ notifications });
  } catch (err) { return dbError(res, err); }
});
socialRouter.patch("/notifications/:id/read", authMiddleware, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid notification id" });
  try { const [notification] = await db.update(notificationsTable).set({ readAt: new Date() }).where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!))).returning(); return res.json({ notification }); } catch (err) { return dbError(res, err); }
});

socialRouter.get("/conversations", authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const rows = await db.select({ id: conversationsTable.id, updatedAt: conversationsTable.updatedAt, memberUserId: conversationMembersTable.userId,
      username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
      .from(conversationsTable).innerJoin(conversationMembersTable, eq(conversationMembersTable.conversationId, conversationsTable.id))
      .innerJoin(usersTable, eq(usersTable.id, conversationMembersTable.userId))
      .where(eq(conversationsTable.id, conversationMembersTable.conversationId)).orderBy(desc(conversationsTable.updatedAt)).limit(100);
    const ids = [...new Set(rows.map(r => r.id))];
    const conversations = await Promise.all(ids.map(async (id) => {
      const members = rows.filter(r => r.id === id && r.memberUserId !== req.userId);
      const other = members[0];
      const [last] = await db.select({ body: messagesTable.body, createdAt: messagesTable.createdAt }).from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(desc(messagesTable.createdAt)).limit(1);
      return { id, userId: other?.memberUserId ?? 0, username: other?.username ?? "", displayName: other?.displayName ?? "Unknown", avatarUrl: other?.avatarUrl ?? null, lastMessage: last?.body ?? "", lastMessageTime: last?.createdAt ?? null, unread: 0, isOnline: false };
    }));
    return res.json({ conversations });
  } catch (err) { return dbError(res, err); }
});
socialRouter.post("/conversations", authMiddleware, async (req: AuthedRequest, res) => {
  const otherUserId = Number(req.body?.userId); if (!Number.isInteger(otherUserId) || otherUserId === req.userId) return res.status(400).json({ error: "Invalid recipient" });
  try { const [conversation] = await db.insert(conversationsTable).values({ updatedAt: new Date() }).returning(); await db.insert(conversationMembersTable).values([{ conversationId: conversation.id, userId: req.userId! }, { conversationId: conversation.id, userId: otherUserId }]); return res.status(201).json({ conversation }); } catch (err) { return dbError(res, err); }
});
socialRouter.get("/conversations/:id/messages", authMiddleware, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid conversation id" });
  try { const [member] = await db.select().from(conversationMembersTable).where(and(eq(conversationMembersTable.conversationId, id), eq(conversationMembersTable.userId, req.userId!))).limit(1); if (!member) return res.status(404).json({ error: "Conversation not found" }); const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(desc(messagesTable.createdAt)).limit(100); return res.json({ messages: messages.reverse() }); } catch (err) { return dbError(res, err); }
});
socialRouter.post("/conversations/:id/messages", authMiddleware, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid conversation id" });
  const { body, mediaUrl, kind } = req.body as { body?: string; mediaUrl?: string; kind?: string }; if (!body?.trim() && !mediaUrl) return res.status(400).json({ error: "Message text or media required" });
  try { const [member] = await db.select().from(conversationMembersTable).where(and(eq(conversationMembersTable.conversationId, id), eq(conversationMembersTable.userId, req.userId!))).limit(1); if (!member) return res.status(404).json({ error: "Conversation not found" }); const [message] = await db.insert(messagesTable).values({ conversationId: id, senderId: req.userId!, body: body?.trim() ?? "", mediaUrl: mediaUrl ?? null, kind: kind ?? (mediaUrl ? "image" : "text") }).returning(); await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, id)); return res.status(201).json({ message }); } catch (err) { return dbError(res, err); }
});

socialRouter.get("/users/:id/followers", authMiddleware, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  try { const users = await db.select(publicUser).from(followsTable).innerJoin(usersTable, eq(usersTable.id, followsTable.followerId)).where(eq(followsTable.followingId, id)).orderBy(desc(followsTable.createdAt)).limit(100); return res.json({ users }); } catch (err) { return dbError(res, err); }
});

socialRouter.get("/users/:id/following", authMiddleware, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  try { const users = await db.select(publicUser).from(followsTable).innerJoin(usersTable, eq(usersTable.id, followsTable.followingId)).where(eq(followsTable.followerId, id)).orderBy(desc(followsTable.createdAt)).limit(100); return res.json({ users }); } catch (err) { return dbError(res, err); }
});

socialRouter.get("/posts/saved", authMiddleware, async (req: AuthedRequest, res) => {
  try { const rows = await db.select().from(postsTable).innerJoin(postEngagementsTable, eq(postEngagementsTable.postId, postsTable.id)).where(and(eq(postEngagementsTable.userId, req.userId!), eq(postEngagementsTable.saved, true))).orderBy(desc(postsTable.createdAt)).limit(100); return res.json({ posts: rows.map(r => r.posts) }); } catch (err) { return dbError(res, err); }
});

export default socialRouter;
