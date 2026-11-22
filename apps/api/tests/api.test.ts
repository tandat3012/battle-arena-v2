// Integration tests trên Redis TEST instance riêng (docker compose --profile test up -d redis-test).
// Mỗi test FLUSHDB — chỉ cho phép khi NODE_ENV=test và URL trỏ tới cổng test 6390.
import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { k } from '../src/keys.js';
import { ensureDefaultConfig } from '../src/modules/game.js';
import { simulateHeartbeat } from '../src/modules/players.js';
import { startRealtimeBridge } from '../src/modules/realtime.js';
import { ensurePlayerIndex } from '../src/modules/search-index.js';
import { closeRedis, connectRedis, redis } from '../src/redis.js';
import { seed } from '../scripts/seed.js';

const PASSWORD = 'test-password-123';
const APP_ORIGIN = 'http://localhost:5173';
const app = createApp();
let cookie: string;

const admin = () => ({
  post: (url: string, body?: object) => request(app).post(url).set('Cookie', cookie).set('Origin', APP_ORIGIN).send(body ?? {}),
  patch: (url: string, body: object) => request(app).patch(url).set('Cookie', cookie).set('Origin', APP_ORIGIN).send(body),
  get: (url: string) => request(app).get(url).set('Cookie', cookie),
});

async function login() {
  const res = await request(app).post('/api/auth/login').set('Origin', APP_ORIGIN).send({ username: 'admin', password: PASSWORD });
  expect(res.status).toBe(200);
  return String(res.headers['set-cookie'][0]).split(';')[0];
}

const match = (over: Partial<Record<string, string>> = {}) => ({
  matchId: randomUUID(),
  seasonId: 's_test_1',
  mode: 'ranked_1v1',
  player1Id: 'p_alpha',
  player2Id: 'p_bravo',
  winnerId: 'p_alpha',
  ...over,
});
const score = (season: string, p: string) => redis.zScore(k.leaderboard(season), p);

beforeAll(async () => {
  if (!config.isTest || !config.redisUrl.includes(':6390')) throw new Error(`Refusing to run tests against ${config.redisUrl}`);
  config.adminUsername = 'admin';
  config.adminPasswordHash = await bcrypt.hash(PASSWORD, 4);
  await connectRedis();
  await startRealtimeBridge();
});

afterAll(async () => {
  await closeRedis();
});

beforeEach(async () => {
  await redis.flushDb();
  await ensureDefaultConfig();
  await ensurePlayerIndex();
  cookie = await login();
  for (const [playerId, displayName] of [['p_alpha', 'Alpha One'], ['p_bravo', 'Bravo Two'], ['p_charlie', 'Charlie Ba'], ['p_delta', 'Delta Bon']]) {
    await admin().post('/api/admin/players', { playerId, displayName, country: 'VN', level: 10 }).expect(201);
  }
  await admin().post('/api/admin/seasons', { seasonId: 's_test_1', name: 'Test Season 1' }).expect(201);
  await admin().post('/api/admin/seasons/s_test_1/activate').expect(200);
});

describe('auth', () => {
  it('T02 login sets HttpOnly cookie and session String with TTL', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', APP_ORIGIN).send({ username: 'admin', password: PASSWORD });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    const token = String(res.headers['set-cookie'][0]).split(';')[0].split('=')[1];
    const key = k.session(createHash('sha256').update(decodeURIComponent(token)).digest('hex'));
    expect(await redis.ttl(key)).toBeGreaterThan(0);
  });

  it('T03 wrong password 5 times → 429, no session created', async () => {
    const before = (await redis.keys(`${k.session('')}*`)).length;
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').set('Origin', APP_ORIGIN).send({ username: 'admin', password: 'wrong' }).expect(401);
    }
    await request(app).post('/api/auth/login').set('Origin', APP_ORIGIN).send({ username: 'admin', password: PASSWORD }).expect(429);
    expect((await redis.keys(`${k.session('')}*`)).length).toBe(before);
  });

  it('concurrent failed logins are capped atomically at five attempts', async () => {
    const responses = await Promise.all(Array.from({ length: 10 }, () =>
      request(app).post('/api/auth/login').set('Origin', APP_ORIGIN).send({ username: 'admin', password: 'wrong' }),
    ));
    expect(responses.filter((res) => res.status === 401)).toHaveLength(5);
    expect(responses.filter((res) => res.status === 429)).toHaveLength(5);
    const keys = await redis.keys(`${k.loginAttempts('')}*`);
    expect(keys).toHaveLength(1);
    expect(await redis.get(keys[0]!)).toBe('5');
    expect(await redis.ttl(keys[0]!)).toBeGreaterThan(0);
  });

  it('T04 write without cookie → 401 and Redis unchanged', async () => {
    const res = await request(app).post('/api/admin/players').set('Origin', APP_ORIGIN).send({ playerId: 'p_x', displayName: 'X X', country: 'VN', level: 1 });
    expect(res.status).toBe(401);
    expect(await redis.sIsMember(k.players, 'p_x')).toBe(0);
  });

  it('rejects cookie-authenticated writes without Origin or same-origin Fetch Metadata', async () => {
    const res = await request(app).post('/api/admin/players').set('Cookie', cookie).send({ playerId: 'p_csrf', displayName: 'CSRF Test', country: 'VN', level: 1 });
    expect(res.status).toBe(403);
    expect(await redis.sIsMember(k.players, 'p_csrf')).toBe(0);
  });

  it('allows same-origin Fetch Metadata when Origin is absent', async () => {
    await request(app).post('/api/admin/players').set('Cookie', cookie).set('Sec-Fetch-Site', 'same-origin')
      .send({ playerId: 'p_fetch', displayName: 'Fetch Test', country: 'VN', level: 1 }).expect(201);
    expect(await redis.sIsMember(k.players, 'p_fetch')).toBe(1);
  });

  it('T05 logout deletes session; next admin call 401', async () => {
    await admin().post('/api/auth/logout').expect(200);
    await admin().get('/api/admin/dashboard').expect(401);
  });

  it('rejects write from foreign Origin', async () => {
    await admin().post('/api/admin/seasons', { seasonId: 's_x', name: 'XX' }).set('Origin', 'http://evil.test').expect(403);
  });
});

describe('players', () => {
  it('T07 create player → Hash, Set, active season participant with score 0', async () => {
    expect(await redis.hGet(k.player('p_alpha'), 'displayName')).toBe('Alpha One');
    expect(await redis.sIsMember(k.players, 'p_alpha')).toBe(1);
    expect(await redis.sIsMember(k.participants('s_test_1'), 'p_alpha')).toBe(1);
    await admin().post('/api/admin/players', { playerId: 'p_new', displayName: 'New Guy', country: 'JP', level: 3 }).expect(201);
    expect(await score('s_test_1', 'p_new')).toBe(0);
  });

  it('T08 duplicate playerId → 409', async () => {
    const res = await admin().post('/api/admin/players', { playerId: 'p_alpha', displayName: 'Other', country: 'US', level: 2 });
    expect(res.status).toBe(409);
    expect(await redis.hGet(k.player('p_alpha'), 'displayName')).toBe('Alpha One');
  });

  it('T09 update reflects in Hash and Search index', async () => {
    await admin().patch('/api/admin/players/p_alpha', { displayName: 'Zeta Renamed', level: 42 }).expect(200);
    expect(await redis.hGet(k.player('p_alpha'), 'level')).toBe('42');
    const res = await request(app).get('/api/public/players?q=zeta');
    expect(res.body.data.items.map((p: { id: string }) => p.id)).toEqual(['p_alpha']);
  });

  it('T10 profile PATCH cannot change score/wins', async () => {
    await admin().patch('/api/admin/players/p_alpha', { totalWins: 99 }).expect(400);
    await admin().patch('/api/admin/players/p_alpha', { score: 9999 }).expect(400);
    expect(await redis.hGet(k.player('p_alpha'), 'totalWins')).toBe('0');
  });

  it('T11/T12 soft delete keeps data, blocks matches; reactivate allows again', async () => {
    await admin().post('/api/admin/matches', match()).expect(201);
    await simulateHeartbeat('p_alpha', 'admin');
    await admin().patch('/api/admin/players/p_alpha/status', { status: 'inactive' }).expect(200);
    expect(await score('s_test_1', 'p_alpha')).toBe(300);
    expect(await redis.zScore(k.online, 'p_alpha')).toBeNull();
    expect((await admin().post('/api/admin/matches', match()).expect(409)).body.error.code).toBe('PLAYER_INACTIVE');
    await admin().post('/api/admin/players/p_alpha/simulate-heartbeat').expect(409);
    await admin().patch('/api/admin/players/p_alpha/status', { status: 'active' }).expect(200);
    expect(await redis.zScore(k.online, 'p_alpha')).toBeNull(); // không tự bật online
    await admin().post('/api/admin/matches', match()).expect(201);
  });
});

describe('seasons', () => {
  it('T13/T14 draft then activate: old closed, pointer moved, zero board', async () => {
    await admin().post('/api/admin/matches', match()).expect(201);
    const created = await admin().post('/api/admin/seasons', { seasonId: 's_test_2', name: 'Test Season 2' });
    expect(created.body.data.status).toBe('draft');
    expect(await redis.get(k.activeSeason)).toBe('s_test_1');
    await admin().post('/api/admin/seasons/s_test_2/activate').expect(200);
    expect(await redis.hGet(k.season('s_test_1'), 'status')).toBe('closed');
    expect(await redis.get(k.activeSeason)).toBe('s_test_2');
    expect(await score('s_test_2', 'p_alpha')).toBe(0);
    expect(await score('s_test_1', 'p_alpha')).toBe(300); // T16 bảng cũ giữ nguyên
    await admin().post('/api/admin/seasons/s_test_1/activate').expect(409); // closed không kích hoạt lại
  });

  it('T15/T23 close active → no pointer, matches rejected', async () => {
    await admin().post('/api/admin/seasons/s_test_1/close').expect(200);
    expect(await redis.exists(k.activeSeason)).toBe(0);
    const res = await admin().post('/api/admin/matches', match());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_SEASON');
  });

  it('rejects reserved seasonId "active"', async () => {
    await admin().post('/api/admin/seasons', { seasonId: 'active', name: 'Bad' }).expect(400);
  });

  it('season creation validates all Redis key types before writing any season data', async () => {
    await redis.del(k.events);
    await redis.set(k.events, 'wrong-type');
    const response = await admin().post('/api/admin/seasons', { seasonId: 's_atomic', name: 'Atomic Test' }).expect(500);
    expect(response.body.error.code).toBe('WRONG_KEY_TYPE');
    expect(await redis.sIsMember(k.seasons, 's_atomic')).toBe(0);
    expect(await redis.exists(k.season('s_atomic'))).toBe(0);
    expect(await redis.get(k.events)).toBe('wrong-type');
  });

  it('concurrent requests for the same season create exactly one Set/Hash/Stream entry', async () => {
    const eventsBefore = await redis.xLen(k.events);
    const responses = await Promise.all(Array.from({ length: 10 }, () =>
      admin().post('/api/admin/seasons', { seasonId: 's_concurrent', name: 'Concurrent Season' }),
    ));
    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(9);
    expect(await redis.sIsMember(k.seasons, 's_concurrent')).toBe(1);
    expect(await redis.hGet(k.season('s_concurrent'), 'status')).toBe('draft');
    expect(await redis.xLen(k.events)).toBe(eventsBefore + 1);
  });
});

describe('matches', () => {
  it('T17 ranked: winner +300, stats, recent List, indexes, Stream event', async () => {
    const body = match();
    const res = await admin().post('/api/admin/matches', body).expect(201);
    expect(res.body.data.match.pointsAwarded).toBe(300);
    expect(res.body.data.winnerAfter.score).toBe(300);
    expect(await score('s_test_1', 'p_alpha')).toBe(300);
    expect(await score('s_test_1', 'p_bravo')).toBe(0);
    expect(await redis.hGet(k.player('p_alpha'), 'totalWins')).toBe('1');
    expect(await redis.hGet(k.player('p_bravo'), 'totalLosses')).toBe('1');
    expect(await redis.hGet(k.stats('s_test_1', 'p_alpha'), 'rankedWins')).toBe('1');
    expect(await redis.lIndex(k.recent, 0)).toBe(body.matchId);
    expect(await redis.zScore(k.seasonMatches('s_test_1'), body.matchId)).not.toBeNull();
    expect(await redis.zScore(k.playerMatches('p_bravo'), body.matchId)).not.toBeNull();
    const [last] = (await redis.xRevRange(k.events, '+', '-', { COUNT: 1 }))!;
    expect(last.message.type).toBe('match.recorded');
  });

  it('T18 friendly: stats/history change, score unchanged', async () => {
    const res = await admin().post('/api/admin/matches', match({ mode: 'friendly_1v1' })).expect(201);
    expect(res.body.data.match.pointsAwarded).toBe(0);
    expect(await score('s_test_1', 'p_alpha')).toBe(0);
    expect(await redis.hGet(k.stats('s_test_1', 'p_alpha'), 'friendlyWins')).toBe('1');
    expect(await redis.lLen(k.recent)).toBe(1);
  });

  it('T19 retry identical → alreadyProcessed, nothing changes', async () => {
    const body = match();
    await admin().post('/api/admin/matches', body).expect(201);
    const again = await admin().post('/api/admin/matches', body).expect(200);
    expect(again.body.data.alreadyProcessed).toBe(true);
    expect(again.body.data.winnerAfter.score).toBe(300);
    expect(await score('s_test_1', 'p_alpha')).toBe(300);
    expect(await redis.hGet(k.player('p_alpha'), 'totalWins')).toBe('1');
    expect(await redis.lLen(k.recent)).toBe(1);
  });

  it('T20 same matchId different winner → 409', async () => {
    const body = match();
    await admin().post('/api/admin/matches', body).expect(201);
    const res = await admin().post('/api/admin/matches', { ...body, winnerId: 'p_bravo' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_ID_CONFLICT');
    expect(await score('s_test_1', 'p_bravo')).toBe(0);
  });

  it('T21 invalid players', async () => {
    expect((await admin().post('/api/admin/matches', match({ player2Id: 'p_ghost' }))).status).toBe(404);
    expect((await admin().post('/api/admin/matches', match({ player2Id: 'p_alpha' }))).status).toBe(422);
    expect((await admin().post('/api/admin/matches', match({ winnerId: 'p_charlie' }))).status).toBe(422);
    await admin().post('/api/admin/matches', { ...match(), pointsAwarded: 9999 }).expect(400);
    expect(await redis.sCard(k.matchIds)).toBe(0);
  });

  it('T22 mode disabled → 409 MODE_DISABLED', async () => {
    await admin().patch('/api/admin/game/modes/ranked_1v1', { enabled: false }).expect(200);
    const res = await admin().post('/api/admin/matches', match());
    expect(res.body.error.code).toBe('MODE_DISABLED');
    await admin().post('/api/admin/matches', match({ mode: 'friendly_1v1' })).expect(201);
  });

  it('T25 concurrent identical requests → exactly one commit', async () => {
    const body = match();
    const results = await Promise.all(Array.from({ length: 10 }, () => admin().post('/api/admin/matches', body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 200)).toHaveLength(9);
    expect(await score('s_test_1', 'p_alpha')).toBe(300);
  });

  it('T24 match racing season close → never half-written', async () => {
    const body = match();
    const [m] = await Promise.all([admin().post('/api/admin/matches', body), admin().post('/api/admin/seasons/s_test_1/close')]);
    const exists = await redis.exists(k.match(body.matchId));
    expect(m.status === 201 ? 1 : 0).toBe(exists);
    expect(await score('s_test_1', 'p_alpha')).toBe(exists ? 300 : 0);
  });

  it('settings change applies only to future ranked matches', async () => {
    await admin().post('/api/admin/matches', match()).expect(201);
    await admin().patch('/api/admin/settings', { activeSeasonRankedWinPoints: 500 }).expect(200);
    const second = await admin().post('/api/admin/matches', match()).expect(201);
    expect(second.body.data.match.pointsAwarded).toBe(500);
    expect(await score('s_test_1', 'p_alpha')).toBe(800);
  });
});

describe('leaderboard, search, online, activity', () => {
  it('T26/T27 rank = ZREVRANK + 1 and ties follow Redis REV order', async () => {
    await admin().post('/api/admin/matches', match({ player1Id: 'p_bravo', player2Id: 'p_charlie', winnerId: 'p_bravo' })).expect(201);
    await admin().post('/api/admin/matches', match({ player1Id: 'p_charlie', player2Id: 'p_delta', winnerId: 'p_charlie' })).expect(201);
    await admin().post('/api/admin/matches', match({ player1Id: 'p_charlie', player2Id: 'p_delta', winnerId: 'p_charlie' })).expect(201);
    const res = await request(app).get('/api/public/leaderboard?seasonId=s_test_1&limit=all').expect(200);
    const items = res.body.data.items as { playerId: string; rank: number; score: number }[];
    for (const it of items) expect(it.rank).toBe((await redis.zRevRank(k.leaderboard('s_test_1'), it.playerId))! + 1);
    expect(items.map((i) => i.playerId)).toEqual(['p_charlie', 'p_bravo', 'p_delta', 'p_alpha']); // 600, 300, 0, 0 (delta > alpha)
    const filtered = await request(app).get('/api/public/leaderboard?seasonId=s_test_1&limit=all&maxScore=300');
    expect(filtered.body.data.items[0]).toMatchObject({ playerId: 'p_bravo', rank: 2 }); // hạng giữ theo toàn bảng
  });

  it('T28 player search uses FT.SEARCH filters', async () => {
    await admin().post('/api/admin/players', { playerId: 'p_jp', displayName: 'Sakura Test', country: 'JP', level: 30 }).expect(201);
    const res = await request(app).get('/api/public/players?country=JP&minLevel=20').expect(200);
    expect(res.body.data.query).toContain('@country:{JP}');
    expect(res.body.data.items.map((p: { id: string }) => p.id)).toEqual(['p_jp']);
  });

  it('T29 online window: stale heartbeat is offline without deleting the ZSet', async () => {
    const now = Date.now();
    await simulateHeartbeat('p_alpha', 'admin', now);
    await simulateHeartbeat('p_bravo', 'admin', now - 10 * 60_000);
    const res = await request(app).get('/api/public/online').expect(200);
    expect(res.body.data.online.map((p: { id: string }) => p.id)).toEqual(['p_alpha']);
    expect(res.body.data.recentlyOffline.map((p: { id: string }) => p.id)).toEqual(['p_bravo']);
    expect(await redis.zCard(k.online)).toBe(2);
  });

  it('T30 activity stream exposes events without secrets', async () => {
    await admin().post('/api/admin/matches', match()).expect(201);
    const res = await admin().get('/api/admin/activity?limit=50').expect(200);
    const types = res.body.data.items.map((e: { type: string }) => e.type);
    expect(types).toContain('match.recorded');
    expect(types).toContain('player.created');
    expect(JSON.stringify(res.body)).not.toMatch(/password|ba_session/i);
  });

  it('T34 redis overview masks session keys', async () => {
    const res = await admin().get('/api/admin/redis-overview').expect(200);
    expect(res.body.data.sensitiveKeysHidden).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/auth:session:[0-9a-f]{8}/);
  });
});

describe('seed', () => {
  it('T37 seed is idempotent', async () => {
    await redis.flushDb();
    expect(await seed(() => {})).toBe(true);
    const snapshot = async () => [
      await redis.sCard(k.players), await redis.sCard(k.matchIds), await redis.lLen(k.recent),
      await redis.zRangeWithScores(k.leaderboard('s2026_02'), 0, -1),
    ];
    const first = await snapshot();
    expect(first[0]).toBe(24);
    expect(first[1]).toBeGreaterThanOrEqual(30);
    expect(await seed(() => {})).toBe(false);
    expect(await snapshot()).toEqual(first);
  });
});
