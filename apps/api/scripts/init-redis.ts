// Khởi tạo idempotent: config mặc định (HSETNX, không ghi đè) + Redis Search index (nếu chưa có).
import { ensureDefaultConfig } from '../src/modules/game.js';
import { ensurePlayerIndex } from '../src/modules/search-index.js';
import { closeRedis, connectRedis, redis } from '../src/redis.js';

try {
  await connectRedis();
  await ensureDefaultConfig();
  console.log('[init] game config: ok (không ghi đè field đã có)');
  console.log((await ensurePlayerIndex()) ? '[init] đã tạo index idx:ba:v2:players' : '[init] index idx:ba:v2:players đã tồn tại');
  console.log('[init] FT._LIST =', await redis.ft._list());
} catch (err) {
  console.error('[init] lỗi:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await closeRedis();
}
