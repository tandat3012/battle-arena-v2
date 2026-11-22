import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../http.js';
import { k } from '../keys.js';
import { redis } from '../redis.js';
import { getGameConfig } from '../modules/game.js';
import { getLeaderboard, leaderboardQuery } from '../modules/leaderboard.js';
import { getMatch, hydrateMatches, listMatches, matchListQuery } from '../modules/matches.js';
import { getOnline } from '../modules/online.js';
import { getPlayerProfile, listPlayers, playerListQuery } from '../modules/players.js';
import { sseHandler } from '../modules/realtime.js';
import { listSeasons, resolveSeasonId } from '../modules/seasons.js';

export const publicRouter = Router();

publicRouter.get('/game', async (_req, res) => {
  const { name, description, status, modes } = await getGameConfig();
  ok(res, { name, description, status, modes });
});

publicRouter.get('/seasons', async (req, res) => {
  const status = z.enum(['draft', 'active', 'closed']).optional().parse(req.query.status);
  const data = await listSeasons();
  ok(res, { ...data, items: status ? data.items.filter((s) => s.status === status) : data.items });
});

publicRouter.get('/dashboard', async (req, res) => {
  const seasonId = await resolveSeasonId(z.string().optional().parse(req.query.seasonId));
  const [totalPlayers, totalMatches, online, board, recentIds] = await Promise.all([
    redis.sCard(k.players), // "Tổng hồ sơ người chơi" — gồm cả inactive
    redis.sCard(k.matchIds),
    getOnline(1000),
    seasonId ? getLeaderboard({ seasonId, limit: '5', page: 1, pageSize: 5 }) : null,
    redis.lRange(k.recent, 0, 5),
  ]);
  ok(res, {
    totalPlayers,
    totalMatches,
    simulatedOnlineCount: online.count,
    selectedSeason: board?.season ?? null,
    top3: board?.items.slice(0, 3) ?? [],
    top5: board?.items ?? [],
    recentMatches: await hydrateMatches(recentIds),
  });
});

publicRouter.get('/leaderboard', async (req, res) => ok(res, await getLeaderboard(leaderboardQuery.parse(req.query))));

publicRouter.get('/players', async (req, res) => ok(res, await listPlayers(playerListQuery.parse(req.query))));

publicRouter.get('/players/:id', async (req, res) => {
  const seasonId = z.string().regex(/^[a-zA-Z0-9_-]{3,40}$/).optional().parse(req.query.seasonId);
  ok(res, await getPlayerProfile(req.params.id, seasonId));
});

publicRouter.get('/matches', async (req, res) => ok(res, await listMatches(matchListQuery.parse(req.query))));

publicRouter.get('/matches/:id', async (req, res) => ok(res, await getMatch(req.params.id)));

publicRouter.get('/online', async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(200).default(50).parse(req.query.limit);
  ok(res, await getOnline(limit));
});

publicRouter.get('/events/leaderboard', sseHandler);
