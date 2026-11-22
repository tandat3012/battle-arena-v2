import { z } from "zod";
import { AppError, luaError } from "../http.js";
import { ID_RE, k } from "../keys.js";
import { redis, runScript } from "../redis.js";
import { getPlayerSummaries, logEvent, toInt } from "./common.js";
import { hydrateMatches } from "./matches.js";
import { buildPlayerQuery, searchPlayerIds } from "./search-index.js";
import { listSeasons } from "./seasons.js";

export const playerIdSchema = z
  .string()
  .regex(ID_RE, "playerId chỉ gồm a-z, A-Z, 0-9, _ hoặc -, dài 3–40 ký tự");
const displayName = z.string().trim().min(2).max(40);
const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Mã quốc gia gồm 2 chữ cái");
const level = z.number().int().min(1).max(100);

export const playerCreateSchema = z
  .object({ playerId: playerIdSchema, displayName, country, level })
  .strict();
// .strict(): gửi score/wins/losses qua form hồ sơ sẽ bị từ chối (T10)
export const playerPatchSchema = z
  .object({ displayName, country, level })
  .partial()
  .strict();
export const playerStatusSchema = z
  .object({ status: z.enum(["active", "inactive"]) })
  .strict();

export const playerListQuery = z.object({
  q: z.string().trim().max(60).optional(),
  country: country.optional(),
  minLevel: z.coerce.number().int().min(1).max(100).optional(),
  maxLevel: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listPlayers(f: z.infer<typeof playerListQuery>) {
  const query = buildPlayerQuery(f);
  const { total, ids } = await searchPlayerIds(
    query,
    (f.page - 1) * f.pageSize,
    f.pageSize,
  );
  const multi = redis.multi();
  for (const id of ids)
    multi.hmGet(k.player(id), ["totalWins", "totalLosses", "createdAt"]);
  const extra = (await multi.execAsPipeline()) as unknown as (
    string | null
  )[][];
  const summaries = await getPlayerSummaries(ids);
  const items = ids.map((id, i) => ({
    ...summaries.get(id)!,
    totalWins: toInt(extra[i][0]),
    totalLosses: toInt(extra[i][1]),
    createdAt: extra[i][2],
  }));
  return { items, total, page: f.page, pageSize: f.pageSize, query };
}

export async function createPlayer(
  input: z.infer<typeof playerCreateSchema>,
  adminId: string,
) {
  // Đọc mùa active để truyền đúng key participants/leaderboard; script kiểm tra lại và báo RETRY nếu vừa đổi.
  for (let attempt = 0; attempt < 3; attempt++) {
    const active = (await redis.get(k.activeSeason)) ?? "";
    const keys = [
      k.players,
      k.player(input.playerId),
      k.activeSeason,
      k.events,
    ];
    if (active) keys.push(k.participants(active), k.leaderboard(active));
    const [status, code] = await runScript("player-create", keys, [
      input.playerId,
      input.displayName,
      input.country,
      input.level,
      new Date().toISOString(),
      active,
      adminId,
    ]);
    if (status === "OK") return getPlayerProfile(input.playerId);
    if (code !== "RETRY") throw luaError(code);
  }
  throw new AppError(
    409,
    "CONCURRENT_UPDATE",
    "Mùa giải vừa thay đổi, hãy thử lại.",
  );
}

async function requirePlayer(id: string) {
  playerIdSchema.parse(id);
  if (!(await redis.sIsMember(k.players, id)))
    throw new AppError(404, "PLAYER_NOT_FOUND", "Không tìm thấy người chơi.");
}

export async function updatePlayer(
  id: string,
  patch: z.infer<typeof playerPatchSchema>,
  adminId: string,
) {
  await requirePlayer(id);
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length)
    throw new AppError(422, "EMPTY_PATCH", "Không có trường nào để cập nhật.");
  // Chỉ field trong whitelist; Redis Search tự cập nhật index khi Hash đổi.
  await redis.hSet(
    k.player(id),
    Object.fromEntries([
      ...entries.map(([f, v]) => [f, String(v)]),
      ["updatedAt", new Date().toISOString()],
    ]),
  );
  await logEvent(
    "player.updated",
    adminId,
    id,
    `Cập nhật hồ sơ ${id}: ${entries.map(([f]) => f).join(", ")}`,
    Object.fromEntries(entries),
  );
  return getPlayerProfile(id);
}

export async function setPlayerStatus(
  id: string,
  status: "active" | "inactive",
  adminId: string,
) {
  await requirePlayer(id);
  const multi = redis
    .multi()
    .hSet(k.player(id), { status, updatedAt: new Date().toISOString() });
  // Vô hiệu hóa: bỏ khỏi online mô phỏng; giữ điểm, lịch sử, membership. Kích hoạt lại KHÔNG tự bật online.
  if (status === "inactive") multi.zRem(k.online, id);
  await multi.exec();
  await logEvent(
    status === "inactive" ? "player.deactivated" : "player.reactivated",
    adminId,
    id,
    `${status === "inactive" ? "Vô hiệu hóa" : "Kích hoạt lại"} người chơi ${id}`,
  );
  return getPlayerProfile(id);
}

export async function getPlayerProfile(id: string, seasonId?: string) {
  await requirePlayer(id);
  const h = await redis.hGetAll(k.player(id));
  const { items: seasons, activeSeasonId } = await listSeasons();

  // Thành tích từng mùa người chơi đã tham gia: điểm/hạng từ Sorted Set, thắng/thua từ stats Hash.
  const multi = redis.multi();
  for (const s of seasons) {
    multi.sIsMember(k.participants(s.id), id);
    multi.zScore(k.leaderboard(s.id), id);
    multi.zRevRank(k.leaderboard(s.id), id);
    multi.hGetAll(k.stats(s.id, id));
  }
  const rows = (await multi.execAsPipeline()) as unknown[];
  const seasonStats = seasons
    .map((s, i) => {
      const [member, score, rank, st] = rows.slice(i * 4, i * 4 + 4) as [
        number,
        number | null,
        number | null,
        Record<string, string>,
      ];
      return {
        seasonId: s.id,
        seasonName: s.name,
        seasonStatus: s.status,
        participant: Boolean(member),
        score: score == null ? null : Number(score),
        rank: rank == null ? null : rank + 1,
        rankedWins: toInt(st.rankedWins),
        rankedLosses: toInt(st.rankedLosses),
        friendlyWins: toInt(st.friendlyWins),
        friendlyLosses: toInt(st.friendlyLosses),
      };
    })
    .filter((s) => s.participant || s.score != null);

  const selectedSeasonId =
    seasonId ?? activeSeasonId ?? seasonStats[0]?.seasonId ?? null;
  const matchIds = await redis.zRange(k.playerMatches(id), 0, 9, { REV: true });
  const lastSeen = await redis.zScore(k.online, id);

  return {
    id,
    displayName: h.displayName,
    country: h.country,
    level: toInt(h.level, 1),
    status: h.status as "active" | "inactive",
    totalWins: toInt(h.totalWins),
    totalLosses: toInt(h.totalLosses),
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    lastSeen:
      lastSeen == null ? null : new Date(Number(lastSeen)).toISOString(),
    selectedSeasonId,
    seasonStats,
    recentMatches: await hydrateMatches(matchIds),
  };
}

export async function simulateHeartbeat(
  id: string,
  adminId: string,
  at = Date.now(),
) {
  await requirePlayer(id);
  if ((await redis.hGet(k.player(id), "status")) !== "active") {
    throw new AppError(
      409,
      "PLAYER_INACTIVE",
      "Chỉ người chơi active mới được mô phỏng heartbeat.",
    );
  }
  await redis.zAdd(k.online, { score: at, value: id });
  await logEvent(
    "player.heartbeat.simulated",
    adminId,
    id,
    `Mô phỏng heartbeat cho ${id}`,
  );
  return {
    playerId: id,
    lastSeen: new Date(at).toISOString(),
    simulated: true,
  };
}
