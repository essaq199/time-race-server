import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  redisUserExists, redisGetUser, redisSetUser,
  type UserRecord,
} from "../lib/redis";

const router = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "timerace-secret-2025-xK9mP";

// ── In-memory fallback (single-instance / dev) ─────────────────────────────
export const memUsers = new Map<string, UserRecord>();

export async function getUser(username: string): Promise<UserRecord | null> {
  const redisUser = await redisGetUser(username);
  if (redisUser) return redisUser;
  return memUsers.get(username.toLowerCase()) ?? null;
}

export async function userExists(username: string): Promise<boolean> {
  if (await redisUserExists(username)) return true;
  return memUsers.has(username.toLowerCase());
}

export async function saveUser(data: UserRecord): Promise<void> {
  await redisSetUser(data.username, data);
  memUsers.set(data.username.toLowerCase(), data);
}

// ── JWT helpers ────────────────────────────────────────────────────────────
export function makeToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { username: string };
  } catch {
    return null;
  }
}

export function authMiddleware(req: any, res: any, next: any): void {
  const auth: string = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "رمز غير صالح" }); return; }
  req.username = payload.username;
  next();
}

// ── Routes ─────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password)
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ error: "الاسم بين 3 و 20 حرف" });
    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(username))
      return res.status(400).json({ error: "الاسم يحتوي على حروف غير مسموح بها" });
    if (password.length < 6)
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    if (await userExists(username))
      return res.status(409).json({ error: "اسم المستخدم مأخوذ بالفعل" });
    const passwordHash = await bcrypt.hash(password, 10);
    const userData: UserRecord = {
      username, passwordHash, wins: 0, losses: 0, gamesPlayed: 0,
    };
    await saveUser(userData);
    const token = makeToken(username);
    res.json({ token, user: { username } });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password)
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    const user = await getUser(username);
    if (!user)
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    const token = makeToken(user.username);
    res.json({ token, user: { username: user.username } });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

export default router;
