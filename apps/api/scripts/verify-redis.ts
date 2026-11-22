// Kiểm tra nhanh Redis V2 (SRS 9.3 / 12.2). Dùng được cho cả instance restore: REDIS_URL=redis://127.0.0.1:6381
import { k } from '../src/keys.js';
import { closeRedis, connectRedis, redis } from '../src/redis.js';

const line = (label: string, value: unknown) => console.log(`${label.padEnd(34)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);

try {
  await connectRedis();
  line('PING', await redis.ping());
  line('redis_version', (await redis.info('server')).match(/redis_version:(.*)/)?.[1]?.trim());
  line('FT._LIST', await redis.ft._list());
  line('TYPE ba:v2:players', await redis.type(k.players));
  line('SCARD ba:v2:players', await redis.sCard(k.players));
  const seasons = await redis.sMembers(k.seasons);
  line('SMEMBERS ba:v2:seasons', seasons.sort());
  const active = await redis.get(k.activeSeason);
  line('GET ba:v2:season:active', active);
  for (const s of seasons.sort()) {
    const top = await redis.zRangeWithScores(k.leaderboard(s), 0, 4, { REV: true });
    line(`top5 ${s}`, top.map((t) => `${t.value}:${t.score}`));
  }
  line('SCARD ba:v2:match:ids', await redis.sCard(k.matchIds));
  line('LLEN ba:v2:matches:recent', await redis.lLen(k.recent));
  line('XLEN ba:v2:events', await redis.xLen(k.events));
  const p = await redis.hGetAll(k.player('player01'));
  line('HGETALL player01', { displayName: p.displayName, totalWins: p.totalWins, totalLosses: p.totalLosses, status: p.status });
  const [mid] = await redis.lRange(k.recent, 0, 0);
  if (mid) {
    const m = await redis.hGetAll(k.match(mid));
    line('HGETALL latest match', { id: m.id, seasonId: m.seasonId, mode: m.mode, winnerId: m.winnerId, pointsAwarded: m.pointsAwarded });
  }
  try {
    const r = await redis.ft.search(k.playerIndex, '@country:{VN} @level:[10 +inf] @status:{active}', { DIALECT: 2, RETURN: [] });
    line('FT.SEARCH VN level>=10 active', `${r.total} kết quả: ${r.documents.map((d) => d.id).join(', ')}`);
  } catch (err) {
    line('FT.SEARCH', `LỖI: ${(err as Error).message} → chạy pnpm init-redis`);
  }
  line('seed version', await redis.get(k.seedVersion));
} catch (err) {
  console.error('[verify] lỗi:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await closeRedis();
}
