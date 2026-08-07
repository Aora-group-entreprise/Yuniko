import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import callsRouter from "./calls";
import socialRouter from "./social";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(postsRouter);
router.use(storiesRouter);
router.use(callsRouter);
router.use(socialRouter);

export default router;