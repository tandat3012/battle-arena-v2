// Seed idempotent cho Redis V2 (SRS 9.2). Không bao giờ FLUSHDB.
// Chạy lần 2: thấy marker → bỏ qua. Có dữ liệu mà không có marker → từ chối, không ghi đè.
import { createHash } from 'node:crypto';
import { config } from '../src/config.js';
import { k } from '../src/keys.js';
import { ensureDefaultConfig } from '../src/modules/game.js';
import { recordMatch } from '../src/modules/matches.js';
import { createPlayer, setPlayerStatus, simulateHeartbeat } from '../src/modules/players.js';
import { ensurePlayerIndex } from '../src/modules/search-index.js';
import { activateSeason, createSeason } from '../src/modules/seasons.js';
import { closeRedis, connectRedis, redis } from '../src/redis.js';
import { ONLINE_NOW, ONLINE_STALE, PLAYERS, SEASON1_MATCHES, SEASON2_MATCHES, SEASONS, SEED_VERSION } from './seed-data.js';

const ACTOR = 'seed';

/** UUID v4 tất định từ một chuỗi → chạy lại cho cùng matchId, Lua tự chặn trùng. */
export function seedUuid(name: string) {
  const h = createHash('sha256').update(`ba-v2-seed:${name}`).digest('hex').split('');
  h[12] = '4';
  h[16] = '89ab'[parseInt(h[16], 16) % 4];
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

const pid = (n: number) => `player${String(n).padStart(2, '0')}`;

export async function seed(log = console.log) {
  const host = new URL(config.redisUrl).hostname;
  if (!['127.0.0.1', 'localhost', 'redis-v2', 'redis-test'].includes(host)) {
    throw new Error(`Từ chối seed: REDIS_URL host "${host}" không phải instance V2 local/test.`);
  }
  await ensureDefaultConfig();
  await ensurePlayerIndex();

  const marker = await redis.get(k.seedVersion);
  if (marker === SEED_VERSION) {
    log(`[seed] đã có marker ${marker} → bỏ qua, không ghi gì thêm.`);
    return false;
  }
  if (marker || (await redis.sCard(k.players)) > 0) {
    throw new Error(`[seed] Redis đã có dữ liệu (marker=${marker ?? 'none'}). Từ chối ghi đè — xử lý thủ công hoặc dùng volume mới.`);
  }

  for (const [playerId, displayName, country, level] of PLAYERS) {
    await createPlayer({ playerId, displayName, country, level }, ACTOR);
  }
  log(`[seed] ${PLAYERS.length} người chơi`);

  const [s1, s2] = SEASONS;
  const play = async (seasonId: string, list: typeof SEASON1_MATCHES, start: string) => {
    let t = new Date(start).getTime();
    for (const [i, [mode, a, b, w]] of list.entries()) {
      t += 9 * 3600_000 + i * 7 * 60_000; // rải thời gian trận cho lịch sử trông thật
      await recordMatch(
        {
          matchId: seedUuid(`${seasonId}-${i}`),
          seasonId,
          mode: mode === 'R' ? 'ranked_1v1' : 'friendly_1v1',
          player1Id: pid(a),
          player2Id: pid(b),
          winnerId: pid(w === 1 ? a : b),
        },
        ACTOR,
        new Date(t),
      );
    }
  };

  await createSeason({ seasonId: s1.seasonId, name: s1.name }, ACTOR, new Date(s1.createdAt));
  await activateSeason(s1.seasonId, ACTOR, new Date(s1.startAt));
  await play(s1.seasonId, SEASON1_MATCHES, s1.startAt);
  log(`[seed] ${s1.seasonId}: ${SEASON1_MATCHES.length} trận`);

  await setPlayerStatus('player23', 'inactive', ACTOR);
  await createSeason({ seasonId: s2.seasonId, name: s2.name }, ACTOR, new Date(s2.createdAt));
  await activateSeason(s2.seasonId, ACTOR, new Date(s2.startAt)); // tự đóng mùa 1
  await play(s2.seasonId, SEASON2_MATCHES, s2.startAt);
  log(`[seed] ${s2.seasonId}: ${SEASON2_MATCHES.length} trận (mùa 1 đã đóng)`);

  const now = Date.now();
  for (const p of ONLINE_NOW) await simulateHeartbeat(p, ACTOR, now);
  for (const p of ONLINE_STALE) await simulateHeartbeat(p, ACTOR, now - 10 * 60_000);

  await redis.set(k.seedVersion, SEED_VERSION);
  log(`[seed] xong, marker ${SEED_VERSION}`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await connectRedis();
    await seed();
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await closeRedis();
  }
}
