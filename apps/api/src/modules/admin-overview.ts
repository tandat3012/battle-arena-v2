import { z } from 'zod';
import { k, NS } from '../keys.js';
import { redis } from '../redis.js';
import { getGameConfig } from './game.js';
import { getOnline } from './online.js';
import { listSeasons } from './seasons.js';

export const activityQuery = z.object({
  cursor: z.string().regex(/^\d+-\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Activity Logs: đọc Stream mới nhất trước (XREVRANGE), phân trang theo Stream ID (exclusive). */
export async function listActivity(q: z.infer<typeof activityQuery>) {
  const end = q.cursor ? `(${q.cursor}` : '+';
  const rows = (await redis.xRevRange(k.events, end, '-', { COUNT: q.limit + 1 })) ?? [];
  const page = rows.slice(0, q.limit);
  return {
    items: page.map((r) => {
      const m = r.message as Record<string, string>;
      let metadata: unknown = {};
      try {
        metadata = JSON.parse(m.metadata ?? '{}');
      } catch {}
      return { id: r.id, type: m.type, actorId: m.actorId, entityId: m.entityId, occurredAt: m.occurredAt, summary: m.summary, metadata };
    }),
    nextCursor: rows.length > q.limit ? page[page.length - 1].id : null,
    total: await redis.xLen(k.events),
  };
}

export async function adminDashboard() {
  const [{ items: seasons, activeSeasonId }, totalPlayers, totalMatches, online, cfg, activity, activeCount] = await Promise.all([
    listSeasons(),
    redis.sCard(k.players),
    redis.sCard(k.matchIds),
    getOnline(1000),
    getGameConfig(),
    listActivity({ limit: 8 }),
    redis.ft.search(k.playerIndex, '@status:{active}', { LIMIT: { from: 0, size: 0 }, DIALECT: 2 }),
  ]);
  return {
    totalPlayers,
    activePlayers: activeCount.total,
    inactivePlayers: totalPlayers - activeCount.total,
    totalMatches,
    simulatedOnlineCount: online.count,
    activeSeason: seasons.find((s) => s.id === activeSeasonId) ?? null,
    seasonCount: seasons.length,
    game: cfg,
    recentActivity: activity.items,
  };
}

const SENSITIVE = [`${NS}auth:session:`, `${NS}auth:login:attempts:`];
const mask = (key: string) => {
  const p = SENSITIVE.find((s) => key.startsWith(s));
  return p ? `${p}••••••••` : key;
};
const SCAN_LIMIT = 5000;

/**
 * Redis Data Overview (chỉ đọc): SCAN có giới hạn theo namespace, đếm theo kiểu dữ liệu,
 * key mẫu đã che phần nhạy cảm (session/rate-limit). Không bao giờ trả giá trị session.
 */
export async function redisOverview() {
  const byType: Record<string, { count: number; samples: string[] }> = {};
  let scanned = 0;
  let sensitiveCount = 0;
  let truncated = false;
  for await (const keys of redis.scanIterator({ MATCH: `${NS}*`, COUNT: 200 })) {
    if (!keys.length) continue;
    const multi = redis.multi();
    for (const key of keys) multi.type(key);
    const types = (await multi.execAsPipeline()) as unknown as string[];
    keys.forEach((key, i) => {
      const t = types[i];
      byType[t] ??= { count: 0, samples: [] };
      byType[t].count++;
      if (SENSITIVE.some((s) => key.startsWith(s))) sensitiveCount++;
      else if (byType[t].samples.length < 4) byType[t].samples.push(mask(key));
    });
    scanned += keys.length;
    if (scanned >= SCAN_LIMIT) {
      truncated = true;
      break;
    }
  }

  const activeSeasonId = await redis.get(k.activeSeason);
  const info = await redis.info('server');
  const mem = await redis.info('memory');
  const pick = (src: string, f: string) => src.match(new RegExp(`^${f}:(.*)$`, 'm'))?.[1]?.trim() ?? null;
  let indexDocs: number | null = null;
  try {
    const ftInfo = (await redis.ft.info(k.playerIndex)) as unknown as { num_docs?: number | string; numDocs?: number | string };
    indexDocs = Number(ftInfo.num_docs ?? ftInfo.numDocs ?? NaN);
  } catch {}

  const [players, seasons, matchIds, recentLen, leaderboardSize, onlineSize, eventsLen, seedVersion] = await Promise.all([
    redis.sCard(k.players),
    redis.sCard(k.seasons),
    redis.sCard(k.matchIds),
    redis.lLen(k.recent),
    activeSeasonId ? redis.zCard(k.leaderboard(activeSeasonId)) : 0,
    redis.zCard(k.online),
    redis.xLen(k.events),
    redis.get(k.seedVersion),
  ]);

  const structures = [
    { type: 'string', label: 'String', usage: 'Session Admin có TTL, rate-limit đăng nhập, pointer mùa active', exampleKey: k.activeSeason, value: activeSeasonId ?? '(không có mùa active)', commands: ['SET … EX', 'GET', 'TTL', 'INCR', 'DEL'] },
    { type: 'hash', label: 'Hash', usage: 'Hồ sơ người chơi, trận đấu, mùa giải, cấu hình game', exampleKey: `${NS}player:player01`, value: `${players} hồ sơ người chơi`, commands: ['HSET', 'HGETALL', 'HINCRBY', 'HMGET'] },
    { type: 'list', label: 'List', usage: 'ID trận gần đây (mới nhất ở đầu)', exampleKey: k.recent, value: `${recentLen} phần tử`, commands: ['LPUSH', 'LTRIM', 'LRANGE', 'LLEN'] },
    { type: 'set', label: 'Set', usage: 'Tập ID người chơi, mùa giải, người tham gia, matchId', exampleKey: k.players, value: `${players} người chơi · ${seasons} mùa · ${matchIds} trận`, commands: ['SADD', 'SISMEMBER', 'SCARD', 'SMEMBERS'] },
    { type: 'zset', label: 'Sorted Set', usage: 'Leaderboard từng mùa, chỉ mục lịch sử theo thời gian, lastSeen', exampleKey: activeSeasonId ? k.leaderboard(activeSeasonId) : `${NS}season:<id>:leaderboard`, value: `${leaderboardSize} thành viên (mùa active) · online ZSet ${onlineSize}`, commands: ['ZADD', 'ZINCRBY', 'ZRANGE … REV', 'ZREVRANK', 'ZSCORE'] },
    { type: 'stream', label: 'Stream', usage: 'Activity Logs nghiệp vụ (MAXLEN ~5000)', exampleKey: k.events, value: `${eventsLen} sự kiện`, commands: ['XADD', 'XREVRANGE', 'XLEN'] },
  ];

  return {
    server: {
      redisVersion: pick(info, 'redis_version'),
      mode: pick(info, 'redis_mode'),
      usedMemoryHuman: pick(mem, 'used_memory_human'),
      dbSize: await redis.dbSize(),
    },
    namespace: NS,
    scan: { scanned, truncated, limit: SCAN_LIMIT, at: new Date().toISOString(), byType },
    sensitiveKeysHidden: sensitiveCount,
    structures,
    search: { index: k.playerIndex, numDocs: indexDocs, example: "FT.SEARCH idx:ba:v2:players '@country:{VN} @level:[10 +inf] @status:{active}'" },
    pubsub: { channel: k.channel },
    seedVersion,
  };
}
