import { k } from '../keys.js';
import { redis } from '../redis.js';

export type EventType =
  | 'player.created' | 'player.updated' | 'player.deactivated' | 'player.reactivated' | 'player.heartbeat.simulated'
  | 'match.recorded' | 'season.created' | 'season.activated' | 'season.closed' | 'game.updated' | 'settings.updated';

/** Ghi activity event vào Stream (giới hạn ~5000 bản ghi). Không bao giờ đưa secret vào metadata. */
export async function logEvent(type: EventType, actorId: string, entityId: string, summary: string, metadata: object = {}) {
  await redis.xAdd(
    k.events,
    '*',
    { type, actorId, entityId, occurredAt: new Date().toISOString(), summary, metadata: JSON.stringify(metadata) },
    { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 5000 } },
  );
}

export const toInt = (v: string | undefined | null, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};

export interface PlayerSummary {
  id: string;
  displayName: string;
  country: string;
  level: number;
  status: 'active' | 'inactive';
}

/** Đọc tên/quốc gia/level/trạng thái nhiều người chơi trong 1 round-trip (pipeline HMGET). */
export async function getPlayerSummaries(ids: string[]): Promise<Map<string, PlayerSummary>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const multi = redis.multi();
  for (const id of unique) multi.hmGet(k.player(id), ['displayName', 'country', 'level', 'status']);
  const rows = (await multi.execAsPipeline()) as unknown as (string | null)[][];
  const map = new Map<string, PlayerSummary>();
  unique.forEach((id, i) => {
    const [displayName, country, level, status] = rows[i];
    map.set(id, {
      id,
      displayName: displayName ?? id,
      country: country ?? '',
      level: toInt(level, 1),
      status: status === 'inactive' ? 'inactive' : 'active',
    });
  });
  return map;
}
