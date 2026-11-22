import { k } from '../keys.js';
import { redis } from '../redis.js';
import { getPlayerSummaries } from './common.js';
import { getGameConfig } from './game.js';

/**
 * Online MÔ PHỎNG: người chơi có lastSeen (ZSet score = epoch ms) trong cửa sổ cấu hình và đang active.
 * Lọc theo timestamp khi đọc — không EXPIRE cả key (sẽ xóa toàn bộ trạng thái).
 */
export async function getOnline(limit = 50, now = Date.now()) {
  const { onlineWindowSeconds } = await getGameConfig();
  const cutoff = now - onlineWindowSeconds * 1000;
  const [onlineRows, recentRows] = await Promise.all([
    redis.zRangeWithScores(k.online, '+inf', cutoff, { BY: 'SCORE', REV: true, LIMIT: { offset: 0, count: limit } }),
    // Đã hết cửa sổ nhưng còn trong ZSet: hiển thị offline kèm lastSeen (minh họa hết hạn)
    redis.zRangeWithScores(k.online, `(${cutoff}`, '-inf', { BY: 'SCORE', REV: true, LIMIT: { offset: 0, count: 20 } }),
  ]);
  const players = await getPlayerSummaries([...onlineRows, ...recentRows].map((r) => r.value));
  const view = (r: { value: string; score: number }) => {
    const p = players.get(r.value)!;
    return { ...p, lastSeen: new Date(r.score).toISOString(), secondsAgo: Math.max(0, Math.round((now - r.score) / 1000)) };
  };
  const online = onlineRows.map(view).filter((p) => p.status === 'active');
  return {
    simulated: true,
    windowSeconds: onlineWindowSeconds,
    serverTime: new Date(now).toISOString(),
    count: online.length,
    online,
    recentlyOffline: recentRows.map(view),
  };
}
