import http from "http";
import app from "./app.js";
import { initSocket } from "./socket.js";
import { logger } from "./lib/logger.js";
import { initRedis } from "./lib/redis.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initRedis().catch((err: unknown) => {
  console.warn("Redis init failed — continuing without Redis", err);
});

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + Socket.io)");
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
