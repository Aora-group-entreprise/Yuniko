import { Router, type IRouter } from "express";
import healthRouter from "./health";
import selfTestRouter from "./self-test";
import authRouter from "./auth";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import usersRouter from "./users";
import interactionsRouter from "./interactions";
import settingsRouter from "./settings";
import accountSettingsRouter from "./account-settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(selfTestRouter);
router.use(authRouter);
router.use(postsRouter);
router.use(storiesRouter);
router.use(usersRouter);
router.use(interactionsRouter);
router.use(settingsRouter);
router.use(accountSettingsRouter);

export default router;
