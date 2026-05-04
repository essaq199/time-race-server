import {
  redisSetRoom, redisGetRoom, redisDelRoom,
  redisSetSocket, redisGetSocket, redisDelSocket,
  redisQueuePush, redisQueueRemove, redisQueuePop2,
} from "./lib/redis.js";

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
  timers: [number, number];
  scores: [number, number];
  tickInterval: ReturnType<typeof setInterval> | null;
  syncInterval: ReturnType<typeof setInterval> | null;
}

const rooms        = new Map<string, GameRoom>();
const socketToRoom = new Map<string, string>();

export interface MatchEntry {
  socketId: string;
  name: string;
  iconIndex: number;
  color: string;
  category: string;
}

const localQueue: MatchEntry[] = [];

export function joinQueue(e: MatchEntry): void {
  leaveQueue(e.socketId);
  localQueue.push(e);
  void redisQueuePush(e);
}

export function leaveQueue(socketId: string): void {
  const i = localQueue.findIndex(e => e.socketId === socketId);
  if (i !== -1) localQueue.splice(i, 1);
  void redisQueueRemove(socketId);
}

export function matchmake(): [MatchEntry, MatchEntry] | null {
  if (localQueue.length < 2) return null;
  return [localQueue.shift()!, localQueue.shift()!];
}

export async function matchmakeRedis(): Promise<[MatchEntry, MatchEntry] | null> {
  const pair = await redisQueuePop2();
  if (!pair) return null;
  const [a, b] = pair as [MatchEntry, MatchEntry];
  leaveQueue(a.socketId);
  leaveQueue(b.socketId);
  return [a, b];
}

function makeCode(): string {
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
  general: ["g1","g2","g3","g4","g5","g6","g7","g8","g9","g10","g11","g12","g13","g14","g15","g16","g17","g18","g19","g20","g21","g22","g23","g24","g25","g26","g27","g28","g29","g30","g31","g32","g33","g34","g35","g36","g37","g38","g39","g40","g41","g42","g43","g44","g45","g46","g47","g48","g49","g50","g51","g52","g53","g54","g55","g56","g57","g58","g59","g60","g61","g62","g63","g64","g65","g66","g67","g68","g69","g70","g71","g72","g73","g74","g75","g76","g77","g78","g79","g80","g81","g82","g83","g84","g85","g86","g87","g88","g89","g90","g91","g92","g93","g94","g95","g96","g97","g98","g99","g100","g101","g102","g103","g104","g105","g106","g107","g108","g109","g110","g111","g112","g113","g114","g115","g116","g117","g118","g119","g120","g121","g122","g123","g124","g125","g126","g127","g128","g129","g130","g131","g132","g133","g134","g135","g136","g137","g138","g139","g140","g141","g142","g143","g144","g145","g146","g147","g148","g149","g150","g151","g152","g153","g154","g155","g156","g157","g158","g159","g160","g161","g162","g163","g164","g165","g166","g167","g168","g169","g170","g171","g172","g173","g174","g175","g176","g177","g178","g179","g180","g181","g182","g183","g184","g185","g186","g187","g188","g189","g190","g191","g192","g193","g194","g195","g196","g197","g198","g199","g200","g201","g202","g203","g204","g205","g206","g207","g208","g209","g210","g212","g213","g214","g215","g216","g217","g218","g219","g220","g221","g222","g223","g224","g225","g226","g227","g228","g229","g230","g231","g232","g233","g234","g235","g236","g237","g238","g239","g240","g241","g242","g243","g244","g245","g246","g247","g248","g249","g250","g251","g252","g253","g254","g255","g256","g257","g258","g259","g260","g261","g262","g263","g264","g265","g266","g267","g268","g269","g270","g271","g272","g273","g274","g275","g276","g277","g278","g279","g280","g281","g282","g283","g284","g285","g286","g287","g288","g289","g290","g291","g292","g293","g294","g295","g296","g297","g298","g299","g300"],
  sports: ["s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13","s14","s15","s16","s17","s18","s19","s20","s21","s22","s23","s24","s25","s26","s27","s28","s29","s30","s31","s32","s33","s34","s35","s36","s37","s38","s39","s40","s41","s42","s43","s44","s45","s46","s47","s48","s49","s50","s51","s52","s53","s54","s55","s56","s57","s58","s59","s60","s61","s62","s63","s64","s65","s66","s67","s68","s69","s70","s71","s72","s73","s74","s75","s76","s77","s78","s79","s80","s81","s82","s83","s84","s85","s86","s87","s88","s89","s90","s91","s92","s93","s94","s95","s96","s97","s98","s99","s100","s101","s102","s103","s104","s105","s106","s107","s108","s109","s110","s111","s112","s113","s114","s115","s116","s117","s118","s119","s120","s121","s122","s123","s124","s125","s126","s127","s128","s129","s130","s131","s132","s133","s134","s135","s136","s137","s138","s139","s140","s141","s142","s143","s144","s145","s146","s147","s148","s149","s150","s151","s152","s153","s154","s155","s156","s157","s158","s159","s160","s161","s162","s163","s164","s165","s166","s167","s168","s169","s170","s171","s172","s173","s174","s175","s176","s177","s178","s179","s180","s181","s182","s183","s184","s185","s186","s187","s188","s189","s190","s191","s192","s193","s194","s195","s196","s197","s198","s199","s200","s201","s202","s203","s204","s205","s206","s207","s208","s209","s210","s211","s212","s213","s214","s215","s216","s217","s218","s219","s220","s221","s222","s223","s224","s225","s226","s227","s228","s229","s230","s231","s232","s233","s234","s235","s236","s237","s238","s239","s240","s241","s242","s243","s244","s245","s246","s247","s248","s249","s250","s251","s252","s253","s254","s255","s256","s257","s258","s259","s260","s261","s262","s263","s264","s265","s266","s267","s268","s269","s270","s271","s272","s273","s274","s275","s276","s277","s278","s279","s280","s281","s282","s283","s284","s285","s286","s287","s288","s289","s290","s291","s292","s293","s294","s295","s296","s297","s298","s299","s300"],
  history: ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15","h16","h17","h18","h19","h20","h21","h22","h23","h24","h25","h26","h27","h28","h29","h30","h31","h32","h33","h34","h35","h36","h37","h38","h39","h40","h41","h42","h43","h44","h45","h46","h47","h48","h49","h50","h51","h52","h53","h54","h55","h56","h57","h58","h59","h60","h61","h62","h63","h64","h65","h66","h67","h68","h69","h70","h71","h72","h73","h74","h75","h76","h77","h78","h79","h80","h81","h82","h83","h84","h85","h86","h87","h88","h89","h90","h91","h92","h93","h94","h95","h96","h97","h98","h99","h100","h101","h102","h103","h104","h105","h106","h107","h108","h109","h110","h111","h112","h113","h114","h115","h116","h117","h118","h119","h120","h121","h122","h123","h124","h125","h126","h127","h128","h129","h130","h131","h132","h133","h134","h135","h136","h137","h138","h139","h140","h141","h142","h143","h144","h145","h146","h147","h148","h149","h150","h151","h152","h153","h154","h155","h156","h157","h158","h159","h160","h161","h162","h163","h164","h165","h166","h167","h168","h169","h170","h171","h172","h174","h175","h176","h177","h178","h179","h180","h181","h182","h183","h184","h185","h186","h187","h188","h189","h190","h191","h192","h193","h194","h195","h196","h197","h198","h199","h200","h201","h202","h203","h204","h205","h206","h207","h208","h209","h210","h211","h212","h213","h214","h216","h217","h218","h220","h222","h223","h224","h225","h226","h227","h228","h229","h230","h231","h232","h233","h234","h235","h236","h237","h238","h239","h240","h241","h242","h243","h244","h245","h246","h247","h248","h249","h250","h251","h252","h253","h254","h255","h256","h257","h260","h261","h262","h263","h264","h265","h266","h267","h268","h269","h270","h271","h272","h273","h274","h275","h276","h277","h278","h279","h280","h281","h282","h283","h284","h285","h286","h287","h288","h289","h290","h291","h292","h294","h295","h297","h299","h300"],
  science: ["sc1","sc2","sc3","sc4","sc5","sc6","sc7","sc8","sc9","sc10","sc11","sc12","sc13","sc14","sc15","sc16","sc17","sc18","sc19","sc20","sc21","sc22","sc23","sc24","sc25","sc26","sc27","sc28","sc29","sc30","sc31","sc32","sc33","sc34","sc35","sc36","sc37","sc38","sc39","sc40","sc41","sc42","sc43","sc44","sc45","sc46","sc47","sc48","sc49","sc50","sc51","sc52","sc53","sc54","sc55","sc56","sc57","sc58","sc59","sc60","sc61","sc62","sc63","sc64","sc65","sc66","sc67","sc68","sc69","sc70","sc71","sc72","sc73","sc74","sc75","sc76","sc77","sc78","sc79","sc80","sc81","sc82","sc83","sc84","sc86","sc87","sc88","sc89","sc90","sc91","sc92","sc93","sc94","sc95","sc96","sc97","sc98","sc99","sc100","sc101","sc102","sc103","sc104","sc105","sc106","sc107","sc108","sc109","sc110","sc111","sc112","sc113","sc114","sc115","sc116","sc117","sc118","sc119","sc120","sc121","sc122","sc123","sc124","sc125","sc126","sc127","sc128","sc129","sc130","sc131","sc132","sc133","sc134","sc135","sc136","sc137","sc138","sc139","sc140","sc141","sc142","sc143","sc144","sc145","sc146","sc147","sc148","sc149","sc150","sc151","sc152","sc153","sc154","sc155","sc156","sc157","sc158","sc159","sc160","sc161","sc162","sc163","sc164","sc165","sc166","sc167","sc168","sc169","sc170","sc171","sc172","sc173","sc174","sc175","sc176","sc177","sc178","sc179","sc180","sc181","sc182","sc183","sc184","sc185","sc186","sc187","sc188","sc189","sc190","sc191","sc192","sc193","sc194","sc195","sc196","sc197","sc198","sc199","sc200","sc201","sc202","sc203","sc204","sc205","sc206","sc207","sc208","sc209","sc210","sc211","sc212","sc213","sc214","sc215","sc216","sc217","sc218","sc219","sc220","sc221","sc222","sc223","sc224","sc225","sc226","sc227","sc228","sc229","sc230","sc231","sc232","sc233","sc234","sc235","sc236","sc237","sc238","sc239","sc240","sc241","sc242","sc243","sc244","sc245","sc246","sc247","sc248","sc249","sc250","sc251","sc252","sc253","sc254","sc255","sc256","sc257","sc258","sc259","sc260","sc261","sc262","sc263","sc264","sc265","sc266","sc267","sc268","sc269","sc270","sc271","sc272","sc273","sc274","sc275","sc276","sc277","sc278","sc279","sc280","sc281","sc282","sc283","sc284","sc285","sc286","sc287","sc288","sc289","sc290","sc291","sc292","sc293","sc294","sc295","sc296","sc297","sc298","sc299","sc300"],
  entertainment: ["e1","e2","e3","e4","e5","e6","e7","e8","e9","e10","e11","e12","e13","e14","e15","e16","e17","e18","e19","e20","e21","e22","e23","e24","e25","e26","e27","e28","e29","e30","e31","e32","e33","e34","e35","e36","e37","e38","e39","e40","e41","e42","e43","e44","e45","e46","e47","e48","e49","e50","e51","e52","e53","e54","e55","e56","e57","e58","e59","e60","e61","e62","e63","e64","e65","e66","e67","e68","e69","e70","e71","e72","e73","e74","e75","e76","e77","e78","e79","e80","e81","e82","e83","e84","e85","e86","e87","e88","e89","e90","e91","e92","e93","e94","e95","e96","e97","e98","e99","e100","e101","e102","e103","e104","e105","e106","e107","e108","e109","e110","e111","e112","e113","e114","e115","e116","e117","e118","e119","e120","e121","e122","e123","e124","e125","e126","e127","e128","e129","e130","e131","e132","e133","e134","e135","e136","e137","e138","e139","e140","e141","e142","e143","e144","e145","e146","e147","e148","e149","e150","e151","e152","e153","e154","e155","e156","e157","e158","e159","e160","e161","e162","e163","e164","e165","e166","e167","e168","e169","e170","e171","e172","e173","e174","e175","e176","e177","e178","e179","e180","e181","e182","e183","e184","e185","e186","e187","e188","e189","e190","e191","e192","e193","e194","e195","e196","e197","e198","e199","e200","e201","e202","e203","e204","e205","e206","e207","e208","e209","e210","e211","e212","e213","e214","e215","e216","e217","e218","e219","e220","e221","e222","e223","e224","e225","e226","e227","e228","e229","e230","e231","e232","e233","e234","e235","e236","e237","e238","e239","e240","e241","e242","e243","e244","e245","e246","e247","e248","e249","e250","e251","e252","e253","e254","e255","e256","e257","e258","e259","e260","e261","e262","e263","e264","e265","e266","e267","e268","e269","e270","e271","e272","e273","e274","e275","e276","e277","e278","e279","e280","e281","e282","e283","e284","e285","e286","e287","e288","e289","e290","e291","e292","e293","e294","e295","e296","e297","e298","e299","e300"],
};

function buildPool(category: string, batches = 2): string[] {
  const src = QUESTIONS_BY_CAT[category] ?? QUESTIONS_BY_CAT["general"]!;
  const result: string[] = [];
  let lastId = "";
  for (let i = 0; i < batches; i++) {
    let batch = shuffle(src);
    if (batch[0] === lastId && batch.length > 1) [batch[0], batch[1]] = [batch[1], batch[0]];
    result.push(...batch);
    lastId = batch[batch.length - 1] ?? "";
  }
  return result;
}

function roomSnapshot(room: GameRoom) {
  const { tickInterval, syncInterval, ...rest } = room;
  void tickInterval; void syncInterval;
  return rest;
}

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
  void redisSetRoom(code, roomSnapshot(room));
  void redisSetSocket(hostSocketId, code);
  return room;
}

export function syncRoom(room: GameRoom): void {
  void redisSetRoom(room.code, roomSnapshot(room));
}

export function getByCode(code: string): GameRoom | null {
  return rooms.get(code.trim().toUpperCase()) ?? null;
}

export async function getByCodeAsync(code: string): Promise<GameRoom | null> {
  const normalized = code.trim().toUpperCase();
  const local = rooms.get(normalized);
  if (local) return local;
  const data = await redisGetRoom(normalized);
  if (!data) return null;
  const room: GameRoom = {
    ...(data as Omit<GameRoom, "tickInterval" | "syncInterval">),
    tickInterval: null,
    syncInterval: null,
  };
  rooms.set(normalized, room);
  return room;
}

export function getBySocket(socketId: string): GameRoom | null {
  const code = socketToRoom.get(socketId);
  return code ? (rooms.get(code) ?? null) : null;
}

export async function getBySocketAsync(socketId: string): Promise<GameRoom | null> {
  const local = getBySocket(socketId);
  if (local) return local;
  const code = await redisGetSocket(socketId);
  if (!code) return null;
  return getByCodeAsync(code);
}

export function addPlayer(
  room: GameRoom, socketId: string,
  name: string, iconIndex: number, color: string,
): RoomPlayer {
  const playerIndex = room.players.length as 0 | 1;
  const p: RoomPlayer = { socketId, name, iconIndex, color, playerIndex };
  room.players.push(p);
  socketToRoom.set(socketId, room.code);
  void redisSetSocket(socketId, room.code);
  syncRoom(room);
  return p;
}

export function startGame(room: GameRoom, category: string, language: "ar" | "en"): string[] {
  room.category = category;
  room.language = language;
  room.status   = "playing";
  room.currentTurn = 0;
  room.questionIdx = 0;
  room.timers   = [600, 600];
  room.scores   = [0, 0];
  room.questionIds = buildPool(category, 1);
  syncRoom(room);
  return room.questionIds;
}

export function removeSocket(socketId: string): { room: GameRoom } | null {
  const room = getBySocket(socketId);
  if (!room) return null;
  socketToRoom.delete(socketId);
  void redisDelSocket(socketId);
  const idx = room.players.findIndex(p => p.socketId === socketId);
  if (idx !== -1) room.players.splice(idx, 1);
  if (room.players.length === 0) {
    stopRoom(room);
    rooms.delete(room.code);
    void redisDelRoom(room.code);
  } else {
    syncRoom(room);
  }
  return { room };
}

export function stopRoom(room: GameRoom): void {
  if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
  if (room.syncInterval) { clearInterval(room.syncInterval); room.syncInterval = null; }
}

export function syncTimers(room: GameRoom): void {
  syncRoom(room);
}

export function isLocalRoom(code: string): boolean {
  return rooms.has(code.toUpperCase());
}
