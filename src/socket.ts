import { Server as IO } from "socket.io";
import type { Server as HttpServer } from "http";
import * as R from "./rooms.js";
import {
  makeSocketAdapter,
  publishGameEvent,
  subscribeGameEvents,
  type GameBusEvent,
} from "./lib/redis.js";

const PENALTY  = 50;
const TICK_MS  = 100;
const SYNC_MS  = 1000;

export function initSocket(http: HttpServer): IO {
  const io = new IO(http, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const adapter = makeSocketAdapter();
  if (adapter) io.adapter(adapter);

  subscribeGameEvents((event: GameBusEvent) => {
    if (!("roomCode" in event) && event.type !== "disconnect") return;
    if (event.type === "submit_answer") {
      const room = R.getByCode(event.roomCode);
      if (!room) return;
      handleSubmitAnswer(room, event.socketId, event.correct, io);
    } else if (event.type === "submit_skip") {
      const room = R.getByCode(event.roomCode);
      if (!room) return;
      handleSubmitSkip(room, event.socketId, io);
    } else if (event.type === "disconnect") {
      const room = R.getBySocket(event.socketId);
      if (!room) return;
      handleDisconnect(event.socketId, room, io);
    }
  });

  io.on("connection", (socket) => {
    const e = (msg: string) => socket.emit("err", { msg });

    socket.on("create_room", ({ name = "لاعب ١", iconIndex = 0, color = "#f97316" } = {}) => {
      try {
        const room = R.createRoom(socket.id);
        const p    = R.addPlayer(room, socket.id, name, iconIndex, color);
        socket.join(room.code);
        socket.emit("room_created", {
          code: room.code, playerIndex: 0,
          player: { name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex },
        });
      } catch { e("خطأ في إنشاء الغرفة"); }
    });

    socket.on("join_room", ({ code, name = "لاعب ٢", iconIndex = 1, color = "#ec4899" } = {}) => {
      R.getByCodeAsync(code ?? "").then(room => {
        if (!room)                     { e("الغرفة غير موجودة"); return; }
        if (room.players.length >= 2)  { e("الغرفة ممتلئة"); return; }
        if (room.status !== "waiting") { e("اللعبة بدأت بالفعل"); return; }
        const player = R.addPlayer(room, socket.id, name, iconIndex, color);
        socket.join(room.code);
        socket.emit("room_joined", {
          code: room.code, playerIndex: player.playerIndex,
          players: room.players.map(p => ({
            name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex,
          })),
        });
        io.to(room.code).except(socket.id).emit("opponent_joined", {
          name: player.name, iconIndex: player.iconIndex,
          color: player.color, playerIndex: player.playerIndex,
        });
      }).catch(() => e("خطأ في الانضمام"));
    });

    socket.on("start_game", ({ category = "general", language = "ar" } = {}) => {
      try {
        const room = R.getBySocket(socket.id);
        if (!room)                           { e("لست في غرفة"); return; }
        if (room.hostSocketId !== socket.id) { e("فقط المضيف يبدأ"); return; }
        if (room.players.length < 2)         { e("ينقص لاعب"); return; }
        const questionIds = R.startGame(room, category, language as "ar" | "en");
        room.players.forEach(p => {
          io.to(p.socketId).emit("you_are", { playerIndex: p.playerIndex });
        });
        io.to(room.code).emit("game_start", {
          players: room.players.map(p => ({
            name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex,
          })),
          category: room.category, language: room.language,
          questionIds, currentTurn: 0, questionIdx: 0,
          timers: [600, 600], scores: [0, 0],
        });
        startLoop(room, io);
      } catch { e("خطأ في بدء اللعبة"); }
    });

    socket.on("submit_answer", async ({ correct = false } = {}) => {
      try {
        const room = await R.getBySocketAsync(socket.id);
        if (!room || room.status !== "playing") return;
        if (!R.isLocalRoom(room.code)) {
          await publishGameEvent({ type: "submit_answer", roomCode: room.code, socketId: socket.id, correct });
          return;
        }
        handleSubmitAnswer(room, socket.id, correct, io);
      } catch { /* صامت */ }
    });

    socket.on("submit_skip", async () => {
      try {
        const room = await R.getBySocketAsync(socket.id);
        if (!room || room.status !== "playing") return;
        if (!R.isLocalRoom(room.code)) {
          await publishGameEvent({ type: "submit_skip", roomCode: room.code, socketId: socket.id });
          return;
        }
        handleSubmitSkip(room, socket.id, io);
      } catch { /* صامت */ }
    });

    socket.on("join_random", ({ name = "لاعب", iconIndex = 0, color = "#f97316", category = "general" } = {}) => {
      try {
        R.joinQueue({ socketId: socket.id, name, iconIndex, color, category });
        socket.emit("random_searching");
        const pair = R.matchmake();
        if (!pair) return;
        launchRandomGame(pair[0], pair[1], io);
      } catch { e("خطأ في المطابقة"); }
    });

    socket.on("leave_random", () => { R.leaveQueue(socket.id); });

    socket.on("disconnect", async () => {
      R.leaveQueue(socket.id);
      const room = R.getBySocket(socket.id);
      if (room) {
        handleDisconnect(socket.id, room, io);
      } else {
        await publishGameEvent({ type: "disconnect", socketId: socket.id });
      }
    });
  });

  return io;
}

function handleSubmitAnswer(room: R.GameRoom, socketId: string, correct: boolean, io: IO) {
  const me = room.players.find(p => p.socketId === socketId);
  if (!me || me.playerIndex !== room.currentTurn) return;
  const pi = room.currentTurn;
  if (correct) {
    room.scores[pi]++;
  } else {
    room.timers[pi] = Math.max(0, room.timers[pi] - PENALTY);
    if (room.timers[pi] <= 0) { endGame(room, pi, io); return; }
  }
  room.currentTurn = (pi === 0 ? 1 : 0) as 0 | 1;
  room.questionIdx++;
  R.syncRoom(room);
  io.to(room.code).emit("answer_result", {
    answeredBy: pi, correct,
    currentTurn: room.currentTurn, questionIdx: room.questionIdx,
    timers: [...room.timers] as [number, number],
    scores: [...room.scores] as [number, number],
  });
}

function handleSubmitSkip(room: R.GameRoom, socketId: string, io: IO) {
  const me = room.players.find(p => p.socketId === socketId);
  if (!me || me.playerIndex !== room.currentTurn) return;
  const pi = room.currentTurn;
  room.timers[pi] = Math.max(0, room.timers[pi] - PENALTY);
  if (room.timers[pi] <= 0) { endGame(room, pi, io); return; }
  room.currentTurn = (pi === 0 ? 1 : 0) as 0 | 1;
  room.questionIdx++;
  R.syncRoom(room);
  io.to(room.code).emit("answer_result", {
    answeredBy: pi, correct: false,
    currentTurn: room.currentTurn, questionIdx: room.questionIdx,
    timers: [...room.timers] as [number, number],
    scores: [...room.scores] as [number, number],
  });
}

function handleDisconnect(socketId: string, room: R.GameRoom, io: IO) {
  const res = R.removeSocket(socketId);
  if (!res) return;
  if (room.players.length > 0 && room.status === "playing") {
    R.stopRoom(room);
    room.status = "finished";
    io.to(room.code).emit("opponent_left");
  }
}

function launchRandomGame(p1: R.MatchEntry, p2: R.MatchEntry, io: IO) {
  const room = R.createRoom(p1.socketId);
  R.addPlayer(room, p1.socketId, p1.name, p1.iconIndex, p1.color);
  R.addPlayer(room, p2.socketId, p2.name, p2.iconIndex, p2.color);
  const s1 = io.sockets.sockets.get(p1.socketId);
  const s2 = io.sockets.sockets.get(p2.socketId);
  s1?.join(room.code);
  s2?.join(room.code);
  const questionIds = R.startGame(room, p1.category ?? "general", "ar");
  room.players.forEach(p => {
    io.to(p.socketId).emit("you_are", { playerIndex: p.playerIndex });
  });
  io.to(room.code).emit("game_start", {
    players: room.players.map(p => ({
      name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex,
    })),
    category: room.category, language: room.language,
    questionIds, currentTurn: 0, questionIdx: 0,
    timers: [600, 600], scores: [0, 0],
    isRandom: true,
  });
  startLoop(room, io);
}

function startLoop(room: R.GameRoom, io: IO) {
  R.stopRoom(room);
  let ticks = 0;
  room.tickInterval = setInterval(() => {
    if (room.status !== "playing") { R.stopRoom(room); return; }
    room.timers[room.currentTurn] = Math.max(0, room.timers[room.currentTurn] - 1);
    if (room.timers[room.currentTurn] <= 0) {
      R.stopRoom(room);
      endGame(room, room.currentTurn, io);
      return;
    }
    ticks++;
    if (ticks % (SYNC_MS / TICK_MS) === 0) {
      R.syncTimers(room);
      io.to(room.code).emit("tick", {
        timers: [...room.timers] as [number, number],
        currentTurn: room.currentTurn,
        questionIdx: room.questionIdx,
        scores: [...room.scores] as [number, number],
      });
    }
  }, TICK_MS);
}

function endGame(room: R.GameRoom, loserIdx: 0 | 1, io: IO) {
  R.stopRoom(room);
  room.status = "finished";
  R.syncRoom(room);
  io.to(room.code).emit("game_over", {
    loserIdx,
    timers: [...room.timers] as [number, number],
    scores: [...room.scores] as [number, number],
  });
}
