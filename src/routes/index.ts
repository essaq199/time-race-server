import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/leaderboard", leaderboardRouter);

export default router;
