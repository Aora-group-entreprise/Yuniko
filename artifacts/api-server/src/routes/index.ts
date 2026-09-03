import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import metricsRouter from "./metrics";
import authRouter from "./auth";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import callsRouter from "./calls";
import socialRouter from "./social";
import socialCompletionRouter from "./social-completion";
import platformEnhancementsRouter from "./platform-enhancements";
import liveStreamRouter from "./live-stream";
import mediaRouter from "./media";
import { assertLiveEnabled } from "../infrastructure/video-features";

const router: IRouter = Router();

function liveFeatureGate(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/live")) return next();
  try {
    assertLiveEnabled();
    return next();
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return res.status(statusCode).json({ error: (error as Error).message });
  }
}

router.use(healthRouter);
router.use(metricsRouter);
router.use(authRouter);
router.use(postsRouter);
router.use(storiesRouter);
router.use(callsRouter);
router.use(socialRouter);
router.use(socialCompletionRouter);
router.use(platformEnhancementsRouter);
router.use(liveFeatureGate);
router.use(liveStreamRouter);
router.use(mediaRouter);

export default router;
