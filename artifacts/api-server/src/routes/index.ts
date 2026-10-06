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
import analyticsRouter from "./analytics";
import messagesRouter from "./messages";
import m5m6Router from "./m5m6";
import pushRouter from "./push";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(selfTestRouter);
router.use(authRouter);
router.use(interactionsRouter);
router.use(pushRouter);
router.use(feedbackRouter);
router.use(messagesRouter);
router.use(m5m6Router);
router.use(postsRouter);
router.use(storiesRouter);
router.use(usersRouter);
router.use(settingsRouter);
router.use(accountSettingsRouter);
router.use(analyticsRouter);

export default router;
