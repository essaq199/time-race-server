import { Router } from "express";
import { users, authMiddleware } from "./auth";

const router = Router();

function getLeaderboard() {
  const entries: {
    username: string; wins: number; losses: number;
    gamesPlayed: number; winRate: number;
  }[] = [];
  for (const [, u] of users.entries()) {
    if (u.gamesPlayed === 0) continue;
    const winRate = Math.round((u.wins / u.gamesPlayed) * 100);
    entries.push({ username: u.username, wins: u.wins, losses: u.losses, gamesPlayed: u.gamesPlayed, winRate });
  }
  entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.username.localeCompare(b.username));
  return entries.slice(0, 50).map((e, i) => ({ ...e, rank: i + 1 }));
}

router.get("/", (_req, res) => {
  res.json({ leaderboard: getLeaderboard() });
});

router.post("/result", authMiddleware, (req: any, res) => {
  try {
    const { won } = req.body ?? {};
    const user = users.get((req.username as string).toLowerCase());
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
    user.gamesPlayed++;
    if (won) user.wins++; else user.losses++;
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "result error");
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

export default router;
