import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { insertRow, supabaseError } from "../lib/supabase";

const feedbackRouter = Router();

feedbackRouter.post("/feedback", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const rating = Number(req.body?.rating ?? 0);
  if (!category || category.length > 80) return res.status(400).json({ error: "Invalid feedback category" });
  if (!message || message.length > 5000) return res.status(400).json({ error: "Feedback message is required" });
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) return res.status(400).json({ error: "Invalid rating" });
  try {
    const feedback = await insertRow("feedback", {
      userId: req.userId!,
      category,
      message,
      rating,
      createdAt: new Date(),
    });
    return res.status(201).json({ feedback });
  } catch (err) {
    return supabaseError(res, err);
  }
});

export default feedbackRouter;
