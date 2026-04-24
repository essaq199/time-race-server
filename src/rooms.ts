export interface RoomPlayer {
  socketId: string;
  name: string;
  iconIndex: number;
  color: string;
  playerIndex: 0 | 1;
}

export interface GameRoom {
  code: string;
  players: RoomPlayer[];
  hostSocketId: string;
  status: "waiting" | "playing" | "finished";
  category: string;
  language: "ar" | "en";
  questionIds: string[];
  currentTurn: 0 | 1;
  questionIdx: number;
  timers: [number, number];   // tenths of second
  scores: [number, number];
  tickInterval: ReturnType<typeof setInterval> | null;
  syncInterval: ReturnType<typeof setInterval> | null;
}

const rooms = new Map<string, GameRoom>();
const socketToRoom = new Map<string, string>();

// ── Matchmaking ───────────────────────────────────────────────────────────────
export interface MatchEntry {
  socketId: string;
  name: string;
  iconIndex: number;
  color: string;
  category: string;
}

const queue: MatchEntry[] = [];

export function joinQueue(e: MatchEntry) {
  leaveQueue(e.socketId);
  queue.push(e);
}

export function leaveQueue(socketId: string) {
  const i = queue.findIndex(e => e.socketId === socketId);
  if (i !== -1) queue.splice(i, 1);
}

export function matchmake(): [MatchEntry, MatchEntry] | null {
  if (queue.length < 2) return null;
  return [queue.shift()!, queue.shift()!];
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const QUESTIONS_BY_CAT: Record<string, string[]> = {
  general: ["g1","g2","g3","g4","g5","g6","g7","g8","g9","g10","g11","g12","g13","g14","g15","g16","g17","g18","g19","g20","g21","g22","g23","g24","g25","g26","g27","g28","g29","g30","g31","g32","g33","g34","g35","g36","g37","g38","g39","g40","g41","g42","g43","g44","g45","g46","g47","g48","g49","g50","g51","g52","g53","g54","g55","g56","g57","g58","g59","g60","g61","g62","g63","g64","g65","g66","g67","g68","g69","g70","g71","g72","g73","g74","g75","g76","g77","g78","g79","g80","g81","g82","g83","g84","g85","g86","g87","g88","g89","g90","g91","g92","g93","g94","g95","g96","g97","g98","g99","g100","g101","g102","g103","g104","g105","g106","g107","g108","g109","g110","g111","g112","g113","g114","g115","g116","g117","g118","g119","g120","g121","g122","g123","g124","g125","g126","g127","g128","g129","g130","g131","g132","g133","g134","g135","g136","g137","g138","g139","g140","g141","g142","g143","g144","g145","g146","g147","g148","g149","g150"],
  sports: ["s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64","s65","s66","s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124","s125","s126","s127","s128","s129","s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150"],
  history: ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15","h16","h17","h18","h19","h20","h21","h22","h23","h24","h25","h26","h27","h28","h29","h30","h31","h32","h33","h34","h35","h36","h37","h38","h39","h40","h41","h42","h43","h44","h45","h46","h47","h48","h49","h50","h51","h52","h53","h54","h55","h56","h57","h58","h59","h60","h61","h62","h63","h64","h65","h66","h67","h68","h69","h70","h71","h72","h73","h74","h75","h76","h77","h78","h79","h80","h81","h82","h83","h84","h85","h86","h87","h88","h89","h90","h91","h92","h93","h94","h95","h96","h97","h98","h99","h100","h101","h102","h103","h104","h105","h106","h107","h108","h109","h110","h111","h112","h113","h114","h115","h116","h117","h118","h119","h120","h121","h122","h123","h124","h125","h126","h127","h128","h129","h130","h131","h132","h133","h134","h135","h136","h137","h138","h139","h140","h141","h142","h143","h144","h145","h146","h147","h148","h149","h150"],
  science: ["sc1","sc2","sc3","sc4","sc5","sc6","sc7","sc8","sc9","sc10","sc11","sc12","sc13","sc14","sc15","sc16","sc17","sc18","sc19","sc20","sc21","sc22","sc23","sc24","sc25","sc26","sc27","sc28","sc29","sc30","sc31","sc32","sc33","sc34","sc35","sc36","sc37","sc38","sc39","sc40","sc41","sc42","sc43","sc44","sc45","sc46","sc47","sc48","sc49","sc50","sc51","sc52","sc53","sc54","sc55","sc56","sc57","sc58","sc59","sc60","sc61","sc62","sc63","sc64","sc65","sc66","sc67","sc68","sc69","sc70","sc71","sc72","sc73","sc74","sc75","sc76","sc77","sc78","sc79","sc80","sc81","sc82","sc83","sc84","sc85","sc86","sc87","sc88","sc89","sc90","sc91","sc92","sc93","sc94","sc95","sc96","sc97","sc98","sc99","sc100","sc101","sc102","sc103","sc104","sc105","sc106","sc107","sc108","sc109","sc110","sc111","sc112","sc113","sc114","sc115","sc116","sc117","sc118","sc119","sc120","sc121","sc122","sc123","sc124","sc125","sc126","sc127","sc128","sc129","sc130","sc131","sc132","sc133","sc134","sc135","sc136","sc137","sc138","sc139","sc140","sc141","sc142","sc143","sc144","sc145","sc146","sc147","sc148","sc149","sc150"],
  entertainment: ["e1","e2","e3","e4","e5","e6","e7","e8","e9","e10","e11","e12","e13","e14","e15","e16","e17","e18","e19","e20","e21","e22","e23","e24","e25","e26","e27","e28","e29","e30","e31","e32","e33","e34","e35","e36","e37","e38","e39","e40","e41","e42","e43","e44","e45","e46","e47","e48","e49","e50","e51","e52","e53","e54","e55","e56","e57","e58","e59","e60","e61","e62","e63","e64","e65","e66","e67","e68","e69","e70","e71","e72","e73","e74","e75","e76","e77","e78","e79","e80","e81","e82","e83","e84","e85","e86","e87","e88","e89","e90","e91","e92","e93","e94","e95","e96","e97","e98","e99","e100","e101","e102","e103","e104","e105","e106","e107","e108","e109","e110","e111","e112","e113","e114","e115","e116","e117","e118","e119","e120","e121","e122","e123","e124","e125","e126","e127","e128","e129","e130","e131","e132","e133","e134","e135","e136","e137","e138","e139","e140","e141","e142","e143","e144","e145","e146","e147","e148","e149","e150"],
};

export function createRoom(hostSocketId: string): GameRoom {
  let code = makeCode();
  while (rooms.has(code)) code = makeCode();
  const room: GameRoom = {
    code, players: [], hostSocketId,
    status: "waiting", category: "general", language: "ar",
    questionIds: [], currentTurn: 0, questionIdx: 0,
    timers: [600, 600], scores: [0, 0],
    tickInterval: null, syncInterval: null,
  };
  rooms.set(code, room);
  socketToRoom.set(hostSocketId, code);
  return room;
}

export function getByCode(code: string): GameRoom | null {
  return rooms.get(code.trim().toUpperCase()) ?? null;
}

export function getBySocket(socketId: string): GameRoom | null {
  const code = socketToRoom.get(socketId);
  return code ? (rooms.get(code) ?? null) : null;
}

export function addPlayer(
  room: GameRoom, socketId: string,
  name: string, iconIndex: number, color: string
): RoomPlayer {
  const playerIndex = room.players.length as 0 | 1;
  const p: RoomPlayer = { socketId, name, iconIndex, color, playerIndex };
  room.players.push(p);
  socketToRoom.set(socketId, room.code);
  return p;
}

/** ينشئ pool كبير بدون تكرار فوري بين الدفعات */
function buildPool(category: string, batches = 5): string[] {
  const src = QUESTIONS_BY_CAT[category] ?? QUESTIONS_BY_CAT.general;
  const result: string[] = [];
  let lastId = "";
  for (let i = 0; i < batches; i++) {
    let batch = shuffle(src);
    // تأكد أول سؤال في الدفعة ≠ آخر سؤال في الدفعة السابقة
    if (batch[0] === lastId && batch.length > 1) {
      [batch[0], batch[1]] = [batch[1], batch[0]];
    }
    result.push(...batch);
    lastId = batch[batch.length - 1];
  }
  return result;
}

export function startGame(room: GameRoom, category: string, language: "ar" | "en"): string[] {
  room.category = category;
  room.language = language;
  room.status = "playing";
  room.currentTurn = 0;
  room.questionIdx = 0;
  room.timers = [600, 600];
  room.scores = [0, 0];
  room.questionIds = buildPool(category, 2);   // 2 دفعات ≈ 54-60 سؤال بدون تكرار كثير
  return room.questionIds;
}

export function removeSocket(socketId: string): { room: GameRoom } | null {
  const room = getBySocket(socketId);
  if (!room) return null;
  socketToRoom.delete(socketId);
  const idx = room.players.findIndex(p => p.socketId === socketId);
  if (idx !== -1) room.players.splice(idx, 1);
  if (room.players.length === 0) {
    stopRoom(room);
    rooms.delete(room.code);
  }
  return { room };
}

export function stopRoom(room: GameRoom) {
  if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
  if (room.syncInterval) { clearInterval(room.syncInterval); room.syncInterval = null; }
}
