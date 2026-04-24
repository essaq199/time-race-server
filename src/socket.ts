/**
 * Socket.io handlers — معمارية نظيفة
 *
 * أحداث السيرفر → الكلاينت:
 *   room_created   { code, playerIndex }
 *   room_joined    { code, playerIndex, players }
 *   opponent_joined { player }
 *   game_start     { players, category, language, questionIds }
 *   answer_result  { answeredBy, correct, currentTurn, questionIdx, timers, scores }
 *   tick           { timers }           (كل ثانية)
 *   game_over      { loserIdx, timers, scores }
 *   opponent_left  {}
 *   err            { msg }
 *
 * الكلاينت → السيرفر:
 *   create_room    { name, iconIndex, color }
 *   join_room      { code, name, iconIndex, color }
 *   start_game     { category, language }
 *   submit_answer  { correct: boolean }
 *   submit_skip    {}
 *   join_random    { name, iconIndex, color, category }
 *   leave_random   {}
 */
import { Server as IO } from "socket.io";
import type { Server as HttpServer } from "http";
import * as R from "./rooms.js";

const PENALTY = 50;   // 5 ثوانٍ (50 × 0.1s)
const TICK_MS = 100;  // تنقيص الوقت كل 100ms
const SYNC_MS = 1000; // إرسال tick كل ثانية

export function initSocket(http: HttpServer): IO {
  const io = new IO(http, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    const e = (msg: string) => socket.emit("err", { msg });

    // ── إنشاء غرفة ─────────────────────────────────────────────────────────
    socket.on("create_room", ({ name = "لاعب ١", iconIndex = 0, color = "#f97316" } = {}) => {
      try {
        const room = R.createRoom(socket.id);
        const p = R.addPlayer(room, socket.id, name, iconIndex, color);
        socket.join(room.code);
        socket.emit("room_created", {
          code: room.code,
          playerIndex: 0,
          player: { name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex },
        });
      } catch { e("خطأ في إنشاء الغرفة"); }
    });

    // ── الانضمام لغرفة ──────────────────────────────────────────────────────
    socket.on("join_room", ({ code, name = "لاعب ٢", iconIndex = 1, color = "#ec4899" } = {}) => {
      try {
        const room = R.getByCode(code ?? "");
        if (!room) return e("الغرفة غير موجودة");
        if (room.players.length >= 2) return e("الغرفة ممتلئة");
        if (room.status !== "waiting") return e("اللعبة بدأت بالفعل");

        const player = R.addPlayer(room, socket.id, name, iconIndex, color);
        socket.join(room.code);

        // أخبر الضيف بمن في الغرفة
        socket.emit("room_joined", {
          code: room.code,
          playerIndex: player.playerIndex,
          players: room.players.map(p => ({
            name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex,
          })),
        });

        // أخبر المضيف بالضيف الجديد
        socket.to(room.code).emit("opponent_joined", {
          name: player.name, iconIndex: player.iconIndex,
          color: player.color, playerIndex: player.playerIndex,
        });
      } catch { e("خطأ في الانضمام"); }
    });

    // ── بدء اللعبة ──────────────────────────────────────────────────────────
    socket.on("start_game", ({ category = "general", language = "ar" } = {}) => {
      try {
        const room = R.getBySocket(socket.id);
        if (!room) return e("لست في غرفة");
        if (room.hostSocketId !== socket.id) return e("فقط المضيف يبدأ");
        if (room.players.length < 2) return e("ينقص لاعب");

        const questionIds = R.startGame(room, category, language);

        // أخبر كل لاعب برقمه قبل بدء اللعبة
        room.players.forEach(p => {
          io.to(p.socketId).emit("you_are", { playerIndex: p.playerIndex });
        });

        io.to(room.code).emit("game_start", {
          players: room.players.map(p => ({
            name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex,
          })),
          category: room.category,
          language: room.language,
          questionIds,
          currentTurn: 0,
          questionIdx: 0,
          timers: [600, 600],
          scores: [0, 0],
        });

        startLoop(room, io);
      } catch { e("خطأ في بدء اللعبة"); }
    });

    // ── إجابة ───────────────────────────────────────────────────────────────
    socket.on("submit_answer", ({ correct = false } = {}) => {
      try {
        const room = R.getBySocket(socket.id);
        if (!room || room.status !== "playing") return;

        const me = room.players.find(p => p.socketId === socket.id);
        if (!me || me.playerIndex !== room.currentTurn) return; // ليس دورك

        const pi = room.currentTurn;

        if (correct) {
          room.scores[pi]++;
        } else {
          room.timers[pi] = Math.max(0, room.timers[pi] - PENALTY);
          if (room.timers[pi] <= 0) return endGame(room, pi, io);
        }

        // الدور ينتقل دائماً
        room.currentTurn = (pi === 0 ? 1 : 0) as 0 | 1;
        room.questionIdx++;

        io.to(room.code).emit("answer_result", {
          answeredBy: pi,
          correct,
          currentTurn: room.currentTurn,
          questionIdx: room.questionIdx,
          timers: [...room.timers] as [number, number],
          scores: [...room.scores] as [number, number],
        });
      } catch { /* صامت */ }
    });

    // ── تخطي ────────────────────────────────────────────────────────────────
    socket.on("submit_skip", () => {
      try {
        const room = R.getBySocket(socket.id);
        if (!room || room.status !== "playing") return;

        const me = room.players.find(p => p.socketId === socket.id);
        if (!me || me.playerIndex !== room.currentTurn) return;

        const pi = room.currentTurn;
        room.timers[pi] = Math.max(0, room.timers[pi] - PENALTY);
        if (room.timers[pi] <= 0) return endGame(room, pi, io);

        room.currentTurn = (pi === 0 ? 1 : 0) as 0 | 1;
        room.questionIdx++;

        io.to(room.code).emit("answer_result", {
          answeredBy: pi,
          correct: false,
          currentTurn: room.currentTurn,
          questionIdx: room.questionIdx,
          timers: [...room.timers] as [number, number],
          scores: [...room.scores] as [number, number],
        });
      } catch { /* صامت */ }
    });

    // ── عشوائي ──────────────────────────────────────────────────────────────
    socket.on("join_random", ({ name = "لاعب", iconIndex = 0, color = "#f97316", category = "general" } = {}) => {
      try {
        R.joinQueue({ socketId: socket.id, name, iconIndex, color, category });
        socket.emit("random_searching");

        const pair = R.matchmake();
        if (!pair) return;

        const [p1, p2] = pair;
        const room = R.createRoom(p1.socketId);
        R.addPlayer(room, p1.socketId, p1.name, p1.iconIndex, p1.color);
        R.addPlayer(room, p2.socketId, p2.name, p2.iconIndex, p2.color);

        const s1 = io.sockets.sockets.get(p1.socketId);
        const s2 = io.sockets.sockets.get(p2.socketId);
        s1?.join(room.code);
        s2?.join(room.code);

        const questionIds = R.startGame(room, p1.category ?? "general", "ar");

        // أخبر كل لاعب برقمه قبل بدء اللعبة
        room.players.forEach(p => {
          io.to(p.socketId).emit("you_are", { playerIndex: p.playerIndex });
        });

        io.to(room.code).emit("game_start", {
          players: room.players.map(p => ({
            name: p.name, iconIndex: p.iconIndex, color: p.color, playerIndex: p.playerIndex,
          })),
          category: room.category,
          language: room.language,
          questionIds,
          currentTurn: 0,
          questionIdx: 0,
          timers: [600, 600],
          scores: [0, 0],
          isRandom: true,
        });

        startLoop(room, io);
      } catch { e("خطأ في المطابقة"); }
    });

    socket.on("leave_random", () => R.leaveQueue(socket.id));

    // ── انقطاع ──────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      R.leaveQueue(socket.id);
      const res = R.removeSocket(socket.id);
      if (!res) return;
      const { room } = res;
      if (room.players.length > 0 && room.status === "playing") {
        R.stopRoom(room);
        room.status = "finished";
        io.to(room.code).emit("opponent_left");
      }
    });
  });

  return io;
}

// ─────────────────────────────────────────────────────────────────────────────

function startLoop(room: R.GameRoom, io: IO) {
  R.stopRoom(room);

  // tick: تنقيص الوقت كل 100ms
  let ticks = 0;
  room.tickInterval = setInterval(() => {
    if (room.status !== "playing") { R.stopRoom(room); return; }

    room.timers[room.currentTurn] = Math.max(0, room.timers[room.currentTurn] - 1);

    if (room.timers[room.currentTurn] <= 0) {
      R.stopRoom(room);
      endGame(room, room.currentTurn, io);
      return;
    }

    // إرسال tick كل ثانية
    ticks++;
    if (ticks % (SYNC_MS / TICK_MS) === 0) {
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
  io.to(room.code).emit("game_over", {
    loserIdx,
    timers: [...room.timers] as [number, number],
    scores: [...room.scores] as [number, number],
  });
}
