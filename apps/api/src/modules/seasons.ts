import { z } from 'zod';
import { AppError, luaError } from '../http.js';
import { ID_RE, k, NS } from '../keys.js';
import { redis, runScript } from '../redis.js';
import { toInt } from './common.js';
import { publishChange } from './realtime.js';

export type SeasonStatus = 'draft' | 'active' | 'closed';

export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  rankedWinPoints: number;
  createdAt: string | null;
  startedAt: string | null;
  closedAt: string | null;
  participantCount: number;
  matchCount: number;
}

export const seasonIdSchema = z
  .string()
  .regex(ID_RE, 'seasonId chỉ gồm a-z, A-Z, 0-9, _ hoặc -, dài 3–40 ký tự')
  .refine((v) => v !== 'active', 'seasonId "active" là giá trị dự trữ');

export const seasonCreateSchema = z.object({ seasonId: seasonIdSchema, name: z.string().trim().min(2).max(60) }).strict();

export async function listSeasons(): Promise<{ items: Season[]; activeSeasonId: string | null }> {
  const [ids, activeSeasonId] = await Promise.all([redis.sMembers(k.seasons), redis.get(k.activeSeason)]);
  const multi = redis.multi();
  for (const id of ids) {
    multi.hGetAll(k.season(id));
    multi.sCard(k.participants(id));
    multi.zCard(k.seasonMatches(id));
  }
  const rows = (await multi.execAsPipeline()) as unknown[];
  const items = ids.map((id, i) => {
    const h = rows[i * 3] as Record<string, string>;
    return {
      id,
      name: h.name ?? id,
      status: (h.status ?? 'draft') as SeasonStatus,
      rankedWinPoints: toInt(h.rankedWinPoints, 300),
      createdAt: h.createdAt ?? null,
      startedAt: h.startedAt || null,
      closedAt: h.closedAt || null,
      participantCount: rows[i * 3 + 1] as number,
      matchCount: rows[i * 3 + 2] as number,
    };
  });
  items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return { items, activeSeasonId };
}

/** Mùa được chọn: ID hợp lệ do client gửi, hoặc mùa active, hoặc mùa mới nhất. */
export async function resolveSeasonId(seasonId?: string): Promise<string | null> {
  if (seasonId) {
    seasonIdSchema.parse(seasonId);
    if (!(await redis.sIsMember(k.seasons, seasonId))) throw new AppError(404, 'SEASON_NOT_FOUND', 'Không tìm thấy mùa giải.');
    return seasonId;
  }
  const active = await redis.get(k.activeSeason);
  if (active) return active;
  const { items } = await listSeasons();
  return items[0]?.id ?? null;
}

export async function getSeason(id: string) {
  const h = await redis.hGetAll(k.season(id));
  if (!h.id) return null;
  return { id, name: h.name, status: h.status as SeasonStatus, rankedWinPoints: toInt(h.rankedWinPoints, 300) };
}

export async function createSeason(input: z.infer<typeof seasonCreateSchema>, adminId: string, at = new Date()) {
  const now = at.toISOString();
  const [status, code] = await runScript(
    'season-create',
    [k.seasons, k.season(input.seasonId), k.config, k.events],
    [input.seasonId, input.name, now, adminId],
  );
  if (status !== 'OK') {
    if (code === 'SEASON_EXISTS')
      throw new AppError(409, 'SEASON_EXISTS', 'Mã mùa giải đã tồn tại.');
    throw luaError(code);
  }
  return getSeason(input.seasonId);
}

export async function activateSeason(id: string, adminId: string, at = new Date()) {
  seasonIdSchema.parse(id);
  const [status, previous, joined] = await runScript(
    'season-activate',
    [k.activeSeason, k.season(id), k.participants(id), k.leaderboard(id), k.players, k.events],
    [id, at.toISOString(), adminId, NS],
  );
  if (status !== 'OK') throw luaError(previous);
  await publishChange({ type: 'season.changed', seasonId: id });
  return { seasonId: id, previousSeasonId: previous || null, participants: Number(joined) };
}

export async function closeSeason(id: string, adminId: string) {
  seasonIdSchema.parse(id);
  const [status, code] = await runScript('season-close', [k.activeSeason, k.season(id), k.events], [id, new Date().toISOString(), adminId]);
  if (status !== 'OK') throw luaError(code);
  await publishChange({ type: 'season.changed', seasonId: id });
  return { seasonId: id, status: 'closed' };
}
