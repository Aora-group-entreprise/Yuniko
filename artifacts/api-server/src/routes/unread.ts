import { Router, Request } from "express";
import { db } from "@workspace/db";
import { conversationMembersTable, messagesTable } from "@workspace/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
type AuthedRequest = Request & { userId?: number };

router.get("/messages/unread-count", authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .innerJoin(conversationMembersTable, eq(conversationMembersTable.conversationId, messagesTable.conversationId))
      .where(and(
        eq(conversationMembersTable.userId, req.userId!),
        ne(messagesTable.senderId, req.userId!),
        isNull(messagesTable.readAt),
      ));
    return res.json({ count: row?.count ?? 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
