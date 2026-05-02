import Redis, { type RedisOptions } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let gameClient: Redis | null = null;

export function getPub(): Redis | null { return pubClient; }
export function getSub(): Redis | null { return subClient; }
export function getGame(): Redis | null { return gameClient; }

export async function initRedis(): Promise<boolean> {
  const url = process.env["REDIS_URL"];
  if (!url) {
    console.warn("No REDIS_URL — single-instance mode");
    return false;
  }
  const opts: RedisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 200, 3000),
    lazyConnect: true,
  };
  pubClient  = new Redis(url, opts);
  subClient  = new Redis(url, opts);
  gameClient = new Redis(url, opts);
  await Promise.all([pubClient.connect(), subClient.connect(), gameClient.connect()]);
  console.log("Redis connected");
  return true;
}

export function makeSocketAdapter() {
  if (!pubClient || !subClient) return null;
  return createAdapter(pubClient, subClient);
}

const GAME_CHANNEL = "game:events";

export type GameBusEvent =
  | { type: "submit_answer"; roomCode: string; socketId: string; correct: boolean }
  | { type: "submit_skip";   roomCode: string; socketId: string }
  | { type: "leave_random";  socketId: string }
  | { type: "disconnect";    socketId: string };

export async function publishGameEvent(event: GameBusEvent): Promise<void> {
  if (!pubClient) return;
  await pubClient.publish(GAME_CHANNEL, JSON.stringify(event));
}

export function subscribeGameEvents(handler: (event: GameBusEvent) => void): void {
  if (!subClient) return;
  subClient.subscribe(GAME_CHANNEL, (err) => {
    if (err) console.error("Redis subscribe error", err);
  });
  subClient.on("message", (_channel, message) => {
    try { handler(JSON.parse(message) as GameBusEvent); } catch { /* ignore */ }
  });
}

const ROOM_TTL = 7200;

export async function redisSetRoom(code: string, data: object): Promise<void> {
  if (!gameClient) return;
  await gameClient.setex(`room:${code}`, ROOM_TTL, JSON.stringify(data));
}

export async function redisGetRoom(code: string): Promise<Record<string, unknown> | null> {
  if (!gameClient) return null;
  const raw = await gameClient.get(`room:${code}`);
  return raw ? JSON.parse(raw) as Record<string, unknown> : null;
}

export async function redisDelRoom(code: string): Promise<void> {
  if (!gameClient) return;
  await gameClient.del(`room:${code}`);
}

export async function redisSetSocket(socketId: string, roomCode: string): Promise<void> {
  if (!gameClient) return;
  await gameClient.setex(`socket:${socketId}`, ROOM_TTL, roomCode);
}

export async function redisGetSocket(socketId: string): Promise<string | null> {
  if (!gameClient) return null;
  return gameClient.get(`socket:${socketId}`);
}

export async function redisDelSocket(socketId: string): Promise<void> {
  if (!gameClient) return;
  await gameClient.del(`socket:${socketId}`);
}

const QUEUE_KEY = "matchmaking:queue";

export async function redisQueuePush(entry: object): Promise<void> {
  if (!gameClient) return;
  await gameClient.rpush(QUEUE_KEY, JSON.stringify(entry));
}

export async function redisQueueRemove(socketId: string): Promise<void> {
  if (!gameClient) return;
  const all = await gameClient.lrange(QUEUE_KEY, 0, -1);
  for (const item of all) {
    try {
      const parsed = JSON.parse(item) as { socketId?: string };
      if (parsed.socketId === socketId) await gameClient.lrem(QUEUE_KEY, 1, item);
    } catch { /* ignore */ }
  }
}

export async function redisQueuePop2(): Promise<[unknown, unknown] | null> {
  if (!gameClient) return null;
  const len = await gameClient.llen(QUEUE_KEY);
  if (len < 2) return null;
  const [a, b] = await Promise.all([
    gameClient.lpop(QUEUE_KEY),
    gameClient.lpop(QUEUE_KEY),
  ]);
  if (!a || !b) return null;
  return [JSON.parse(a), JSON.parse(b)];
}
