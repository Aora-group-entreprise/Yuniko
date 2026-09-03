import { Router, type Request } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable, conversationMembersTable, messagesTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth";
import { positiveId } from "../middlewares/validation";

const router = Router();
type R = Request & { userId?: number };

// Notification state
router.get("/notifications/unread-count", authMiddleware, async (req: R, res) => {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.userId!), isNull(notificationsTable.readAt)));
    return res.json({ count: row?.count ?? 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/notifications/read-all", authMiddleware, async (req: R, res) => {
  try {
    await db.update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.userId, req.userId!), isNull(notificationsTable.readAt)));
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

// Conversation read state and unread messages
router.get("/conversations/unread-count", authMiddleware, async (req: R, res) => {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .innerJoin(conversationMembersTable, eq(conversationMembersTable.conversationId, messagesTable.conversationId))
      .where(and(
        eq(conversationMembersTable.userId, req.userId!),
        sql`${messagesTable.senderId} <> ${req.userId!}`,
        sql`(${conversationMembersTable.lastReadAt} is null or ${messagesTable.createdAt} > ${conversationMembersTable.lastReadAt})`
      ));
    return res.json({ count: row?.count ?? 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/conversations/:id/read", authMiddleware, async (req: R, res) => {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid conversation id" });
  try {
    const [member] = await db.update(conversationMembersTable)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationMembersTable.conversationId, id), eq(conversationMembersTable.userId, req.userId!)))
      .returning({ id: conversationMembersTable.id, lastReadAt: conversationMembersTable.lastReadAt });
    return member ? res.json({ read: true, lastReadAt: member.lastReadAt }) : res.status(404).json({ error: "Conversation not found" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/conversations/:conversationId/messages/:messageId/read", authMiddleware, async (req: R, res) => {
  const conversationId = positiveId(req.params.conversationId);
  const messageId = positiveId(req.params.messageId);
  if (!conversationId || !messageId) return res.status(400).json({ error: "Invalid message" });
  try {
    const [member] = await db.select({ id: conversationMembersTable.id })
      .from(conversationMembersTable)
      .where(and(eq(conversationMembersTable.conversationId, conversationId), eq(conversationMembersTable.userId, req.userId!)))
      .limit(1);
    if (!member) return res.status(404).json({ error: "Conversation not found" });
    const [message] = await db.update(messagesTable)
      .set({ readAt: new Date() })
      .where(and(
        eq(messagesTable.id, messageId),
        eq(messagesTable.conversationId, conversationId),
        sql`${messagesTable.senderId} <> ${req.userId!}`
      ))
      .returning({ id: messagesTable.id, readAt: messagesTable.readAt });
    return message ? res.json({ message }) : res.status(404).json({ error: "Message not found" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
