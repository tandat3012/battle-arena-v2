import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError, luaError } from '../http.js';
import { k, MODES, UUID_V4_RE, type Mode } from '../keys.js';
import { redis, runScript } from '../redis.js';
import { getPlayerSummaries, toInt } from './common.js';
import { publishChange } from './realtime.js';

const id = z.string().regex(/^[a-zA-Z0-9_-]{3,40}$/);

export const matchCreateSchema = z
  .object({
    matchId: z.string().regex(UUID_V4_RE, 'matchId phải là UUID v4'),
    seasonId: id,
    mode: z.enum(MODES),
    player1Id: id,
    player2Id: id,
    winnerId: id,
  })
  .strict(); // không nhận pointsAwarded từ client

export const matchListQuery = z.object({
  seasonId: id.optional(),
  mode: z.enum(MODES).optional(),
  playerId: id.optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface MatchView {
  id: string;
  seasonId: string;
  mode: Mode;
  player1: { id: string; displayName: string; country: string; status: string };
  player2: { id: string; displayName: string; country: string; status: string };
  winnerId: string;
  loserId: string;
  pointsAwarded: number;
  recordedAt: string;
  winnerScoreBefore: number;
  winnerScoreAfter: number;
  winnerRankBefore: number | null;
  winnerRankAfter: number | null;
  createdBy?: string;
}

function toView(h: Record<string, string>, players: Awaited<ReturnType<typeof getPlayerSummaries>>, admin: boolean): MatchView {
  const p = (pid: string) => {
    const s = players.get(pid);
    return { id: pid, displayName: s?.displayName ?? pid, country: s?.country ?? '', status: s?.status ?? 'active' };
  };
  return {
    id: h.id,
    seasonId: h.seasonId,
    mode: h.mode as Mode,
    player1: p(h.player1Id),
    player2: p(h.player2Id),
    winnerId: h.winnerId,
    loserId: h.loserId,
    pointsAwarded: toInt(h.pointsAwarded),
    recordedAt: h.recordedAt,
    winnerScoreBefore: toInt(h.winnerScoreBefore),
    winnerScoreAfter: toInt(h.winnerScoreAfter),
    winnerRankBefore: h.winnerRankBefore ? toInt(h.winnerRankBefore) : null,
    winnerRankAfter: h.winnerRankAfter ? toInt(h.winnerRankAfter) : null,
    // requestDigest không bao giờ trả ra ngoài; createdBy chỉ cho Admin
    ...(admin ? { createdBy: h.createdBy } : {}),
  };
}

/** Đọc Hash của nhiều trận (pipeline) + ghép tên người chơi. Bỏ qua ID không còn Hash. */
export async function hydrateMatches(ids: string[], admin = false): Promise<MatchView[]> {
  if (!ids.length) return [];
  const multi = redis.multi();
  for (const mid of ids) multi.hGetAll(k.match(mid));
  const hashes = ((await multi.execAsPipeline()) as unknown as Record<string, string>[]).filter((h) => h.id);
  const players = await getPlayerSummaries(hashes.flatMap((h) => [h.player1Id, h.player2Id]));
  return hashes.map((h) => toView(h, players, admin));
}

export async function getMatch(matchId: string, admin = false) {
  if (!UUID_V4_RE.test(matchId)) throw new AppError(400, 'INVALID_MATCH_ID', 'matchId phải là UUID v4.');
  const [m] = await hydrateMatches([matchId], admin);
  if (!m) throw new AppError(404, 'MATCH_NOT_FOUND', 'Không tìm thấy trận đấu.');
  return m;
}

export function requestDigest(m: z.infer<typeof matchCreateSchema>) {
  return createHash('sha256').update([m.seasonId, m.mode, m.player1Id, m.player2Id, m.winnerId].join('|')).digest('hex');
}

/** Ghi trận qua Lua (nguyên tử + idempotent). `at` chỉ dùng cho seed dữ liệu lịch sử. */
export async function recordMatch(input: z.infer<typeof matchCreateSchema>, adminId: string, at = new Date()) {
  const { matchId, seasonId, mode, player1Id: p1, player2Id: p2, winnerId } = input;
  // Pre-check để báo lỗi dễ hiểu; Lua vẫn kiểm tra lại toàn bộ trong lúc ghi.
  if (p1 === p2) throw luaError('SAME_PLAYER');
  if (winnerId !== p1 && winnerId !== p2) throw luaError('INVALID_WINNER');
  const loserId = winnerId === p1 ? p2 : p1;

  const keys = [
    k.activeSeason, k.season(seasonId), k.config, k.players,
    k.player(p1), k.player(p2), k.participants(seasonId), k.stats(seasonId, p1), k.stats(seasonId, p2),
    k.leaderboard(seasonId), k.matchIds, k.match(matchId), k.recent,
    k.seasonMatches(seasonId), k.playerMatches(p1), k.playerMatches(p2), k.events,
  ];
  const [status, code] = await runScript('match-record', keys, [
    matchId, requestDigest(input), seasonId, mode, p1, p2, winnerId, loserId, at.toISOString(), at.getTime(), adminId,
  ]);
  if (status === 'ERR') throw luaError(code);

  const alreadyProcessed = status === 'DUP';
  const match = await getMatch(matchId, true);
  if (!alreadyProcessed && mode === 'ranked_1v1') {
    await publishChange({ type: 'leaderboard.changed', seasonId, matchId });
  }
  const [loserScore, loserRank] = await Promise.all([
    redis.zScore(k.leaderboard(seasonId), loserId),
    redis.zRevRank(k.leaderboard(seasonId), loserId),
  ]);
  return {
    match,
    alreadyProcessed,
    // before/after lưu trong match Hash lúc xử lý gốc → retry trả đúng số liệu lần đầu
    winnerBefore: { score: match.winnerScoreBefore, rank: match.winnerRankBefore },
    winnerAfter: { score: match.winnerScoreAfter, rank: match.winnerRankAfter },
    loserCurrent: { score: loserScore == null ? null : Number(loserScore), rank: loserRank == null ? null : loserRank + 1 },
  };
}

const CHUNK = 50;

/** Lịch sử trận mới nhất trước. Nguồn: index theo player → theo mùa → List recent. Cursor = vị trí trong index. */
export async function listMatches(q: z.infer<typeof matchListQuery>, admin = false) {
  const source = q.playerId
    ? { key: k.playerMatches(q.playerId), zset: true }
    : q.seasonId
      ? { key: k.seasonMatches(q.seasonId), zset: true }
      : { key: k.recent, zset: false };
  const filterSeason = q.playerId && q.seasonId ? q.seasonId : undefined;
  const keep = (m: MatchView) => (!q.mode || m.mode === q.mode) && (!filterSeason || m.seasonId === filterSeason);
  const fetch = (start: number) =>
    source.zset
      ? redis.zRange(source.key, start, start + CHUNK - 1, { REV: true })
      : redis.lRange(source.key, start, start + CHUNK - 1);

  const items: MatchView[] = [];
  let pos = q.cursor;
  let exhausted = false;
  while (items.length < q.limit) {
    const ids = await fetch(pos);
    if (!ids.length) {
      exhausted = true;
      break;
    }
    const views = new Map((await hydrateMatches(ids, admin)).map((m) => [m.id, m]));
    for (const mid of ids) {
      pos++;
      const m = views.get(mid);
      if (m && keep(m)) items.push(m);
      if (items.length === q.limit) break;
    }
    if (ids.length < CHUNK && items.length < q.limit) {
      exhausted = true;
      break;
    }
  }
  const total = q.mode || filterSeason ? null : source.zset ? await redis.zCard(source.key) : await redis.lLen(source.key);
  return {
    items,
    total,
    nextCursor: exhausted || (total != null && pos >= total) ? null : String(pos),
    source: source.zset ? (q.playerId ? 'player-index' : 'season-index') : 'recent-list',
  };
}
