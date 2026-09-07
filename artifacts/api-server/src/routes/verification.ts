import { Router, Request } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { positiveId } from "../middlewares/validation";

const router = Router();
router.get("/users/:id/verification", authMiddleware, async (req: Request, res) => {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid user id" });
  try {
    const [user] = await db.select({ verificationStatus: usersTable.verificationStatus }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ verificationStatus: user.verificationStatus === "approved" ? "approved" : "none" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});
export default router;
