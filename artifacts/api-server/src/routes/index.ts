import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import usersRouter from "./users";
import interactionsRouter from "./interactions";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(postsRouter);
router.use(storiesRouter);
router.use(usersRouter);
router.use(interactionsRouter);
router.use(settingsRouter);

export default router;
