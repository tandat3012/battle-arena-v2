import { z } from "zod";
import { k } from "../keys.js";
import { redis } from "../redis.js";
import { getPlayerSummaries, toInt } from "./common.js";
import { buildPlayerQuery, searchPlayerIds } from "./search-index.js";
import { getSeason, resolveSeasonId } from "./seasons.js";

export const leaderboardQuery = z.object({
  seasonId: z.string().optional(),
  limit: z.enum(["5", "10", "all"]).default("10"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  minScore: z.coerce.number().int().min(0).optional(),
  maxScore: z.coerce.number().int().min(0).optional(),
  q: z.string().trim().max(60).optional(),
});

export const TIE_RULE =
  "Đồng điểm: thứ tự theo cách Redis Sorted Set sắp xếp khi đọc giảm dần (ZRANGE … REV) — cùng điểm thì playerId lớn hơn theo thứ tự từ điển đứng trước. Đây là thứ tự kỹ thuật, không phải đồng hạng thi đấu.";

type Entry = { playerId: string; score: number; rank: number };

export async function getLeaderboard(input: z.infer<typeof leaderboardQuery>) {
  const seasonId = await resolveSeasonId(input.seasonId);
  if (!seasonId)
    return {
      season: null,
      items: [],
      total: 0,
      page: 1,
      pageSize: 0,
      filtered: false,
      tieRule: TIE_RULE,
    };
  const key = k.leaderboard(seasonId);
  const size = input.limit === "all" ? input.pageSize : Number(input.limit);
  const page = input.limit === "all" ? input.page : 1;
  const start = (page - 1) * size;
  const filtered =
    input.minScore != null || input.maxScore != null || Boolean(input.q);

  let entries: Entry[];
  let total: number;
  if (!filtered) {
    const rows = await redis.zRangeWithScores(key, start, start + size - 1, {
      REV: true,
    });
    entries = rows.map((r, i) => ({
      playerId: r.value,
      score: r.score,
      rank: start + i + 1,
    }));
    total = await redis.zCard(key);
  } else {
    // shortcut: đọc toàn bộ phần ZSet khớp khoảng điểm rồi giao với kết quả Search trong bộ nhớ —
    // ổn với quy mô đồ án (24–50 người); dữ liệu lớn thì cần phân trang theo cursor ở Redis.
    const rows = await redis.zRangeWithScores(
      key,
      input.maxScore ?? "+inf",
      input.minScore ?? "-inf",
      { BY: "SCORE", REV: true },
    );
    let candidates = rows;
    if (input.q) {
      const { ids } = await searchPlayerIds(
        buildPlayerQuery({ q: input.q }),
        0,
        1000,
      );
      const match = new Set(ids);
      candidates = rows.filter((r) => match.has(r.value));
    }
    total = candidates.length;
    const pageRows = candidates.slice(start, start + size);
    // Hạng luôn tính trên TOÀN bộ leaderboard của mùa, không đánh lại từ 1 trên kết quả lọc.
    const multi = redis.multi();
    for (const r of pageRows) multi.zRevRank(key, r.value);
    const ranks = (await multi.execAsPipeline()) as unknown as number[];
    entries = pageRows.map((r, i) => ({
      playerId: r.value,
      score: r.score,
      rank: ranks[i] + 1,
    }));
  }

  const players = await getPlayerSummaries(entries.map((e) => e.playerId));
  const multi = redis.multi();
  for (const e of entries) multi.hGetAll(k.stats(seasonId, e.playerId));
  const stats = (await multi.execAsPipeline()) as unknown as Record<
    string,
    string
  >[];

  const items = entries.map((e, i) => {
    const p = players.get(e.playerId)!;
    const rankedWins = toInt(stats[i].rankedWins);
    const rankedLosses = toInt(stats[i].rankedLosses);
    const played = rankedWins + rankedLosses;
    return {
      rank: e.rank,
      playerId: e.playerId,
      displayName: p.displayName,
      country: p.country,
      level: p.level,
      status: p.status,
      score: e.score,
      rankedWins,
      rankedLosses,
      friendlyWins: toInt(stats[i].friendlyWins),
      friendlyLosses: toInt(stats[i].friendlyLosses),
      winRate: played ? Math.round((rankedWins / played) * 1000) / 10 : null,
    };
  });

  return {
    season: await getSeason(seasonId),
    items,
    total,
    page,
    pageSize: size,
    filtered,
    tieRule: TIE_RULE,
  };
}
