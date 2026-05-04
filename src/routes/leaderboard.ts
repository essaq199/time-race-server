import { Router } from "express";
import { redisGetLeaderboard, redisUpdateUserStats } from "../lib/redis";
import { authMiddleware, getUser, saveUser, memUsers } from "./auth";

const router = Router();

async function buildLeaderboard(limit = 50) {
  // Try Redis first
  const redisEntries = await redisGetLeaderboard(limit);
  if (redisEntries.length > 0) {
    return redisEntries
      .sort((a, b) => b.wins - a.wins || (b.wins / Math.max(b.gamesPlayed,1)) - (a.wins / Math.max(a.gamesPlayed,1)))
      .slice(0, limit)
      .map((e, i) => ({
        username: e.username,
        wins: e.wins,
        losses: e.losses,
        gamesPlayed: e.gamesPlayed,
        winRate: e.gamesPlayed > 0 ? Math.round((e.wins / e.gamesPlayed) * 100) : 0,
        rank: i + 1,
      }));
  }
  // Fallback: in-memory
  const entries = [];
  for (const [, u] of memUsers.entries()) {
    if (u.gamesPlayed === 0) continue;
    const winRate = Math.round((u.wins / u.gamesPlayed) * 100);
    entries.push({ username: u.username, wins: u.wins, losses: u.losses, gamesPlayed: u.gamesPlayed, winRate });
  }
  return entries
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

router.get("/", async (_req, res) => {
  res.json({ leaderboard: await buildLeaderboard() });
});

router.post("/result", authMiddleware, async (req: any, res) => {
  try {
    const { won } = req.body ?? {};
    const username: string = req.username;
    // Try Redis update first
    const updated = await redisUpdateUserStats(username, !!won);
    if (updated) {
      res.json({ ok: true, wins: updated.wins, losses: updated.losses, gamesPlayed: updated.gamesPlayed });
      return;
    }
    // Fallback: in-memory
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
    user.gamesPlayed++;
    if (won) user.wins++; else user.losses++;
    await saveUser(user);
    res.json({ ok: true, wins: user.wins, losses: user.losses, gamesPlayed: user.gamesPlayed });
  } catch (err) {
    req.log.error({ err }, "result error");
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

export default router;
