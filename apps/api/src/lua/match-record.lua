-- Ghi một trận 1v1 nguyên tử + idempotent (SRS 7.2).
-- Lua không rollback khi lỗi giữa chừng → MỌI kiểm tra nằm trước lệnh ghi đầu tiên.
-- KEYS: 1 season:active, 2 season hash, 3 game:config, 4 players set,
--       5 player1 hash, 6 player2 hash, 7 participants, 8 stats p1, 9 stats p2,
--       10 leaderboard, 11 match:ids, 12 match hash, 13 matches:recent,
--       14 season matches zset, 15 player1 matches zset, 16 player2 matches zset, 17 events stream
-- ARGV: 1 matchId, 2 requestDigest, 3 seasonId, 4 mode, 5 p1, 6 p2, 7 winner, 8 loser,
--       9 recordedAtISO, 10 recordedAtMs, 11 adminId
local matchId, digest, seasonId, mode = ARGV[1], ARGV[2], ARGV[3], ARGV[4]
local p1, p2, winner, loser = ARGV[5], ARGV[6], ARGV[7], ARGV[8]
local iso, ms, admin = ARGV[9], ARGV[10], ARGV[11]

-- 1. Idempotency: cùng matchId + cùng digest → trả trận cũ, không ghi lại
if redis.call('EXISTS', KEYS[12]) == 1 then
  if redis.call('HGET', KEYS[12], 'requestDigest') == digest then return {'DUP'} end
  return {'ERR', 'MATCH_ID_CONFLICT'}
end

-- 2. Mùa giải: pointer active phải trùng và Hash ở trạng thái active
local active = redis.call('GET', KEYS[1])
if not active then return {'ERR', 'NO_ACTIVE_SEASON'} end
if active ~= seasonId or redis.call('HGET', KEYS[2], 'status') ~= 'active' then
  return {'ERR', 'SEASON_NOT_ACTIVE'}
end

-- 3. Game và mode (đọc trạng thái thật, không tin pre-check của API)
local cfg = redis.call('HMGET', KEYS[3], 'status', 'rankedEnabled', 'friendlyEnabled', 'recentHistoryLimit')
if cfg[1] ~= 'active' then return {'ERR', 'GAME_MAINTENANCE'} end
local ranked = mode == 'ranked_1v1'
if (ranked and cfg[2] ~= 'true') or (not ranked and cfg[3] ~= 'true') then
  return {'ERR', 'MODE_DISABLED'}
end

-- 4. Người chơi
if p1 == p2 then return {'ERR', 'SAME_PLAYER'} end
if not ((winner == p1 and loser == p2) or (winner == p2 and loser == p1)) then
  return {'ERR', 'INVALID_WINNER'}
end
local pkeys = {{p1, KEYS[5]}, {p2, KEYS[6]}}
for _, p in ipairs(pkeys) do
  if redis.call('SISMEMBER', KEYS[4], p[1]) == 0 then return {'ERR', 'PLAYER_NOT_FOUND'} end
  if redis.call('HGET', p[2], 'status') ~= 'active' then return {'ERR', 'PLAYER_INACTIVE'} end
  if redis.call('SISMEMBER', KEYS[7], p[1]) == 0 then return {'ERR', 'NOT_PARTICIPANT'} end
end

-- 5. Kiểu key trước khi ghi (tránh WRONGTYPE giữa chừng)
local expect = {[10] = 'zset', [11] = 'set', [13] = 'list', [14] = 'zset', [15] = 'zset', [16] = 'zset', [17] = 'stream', [8] = 'hash', [9] = 'hash'}
for i, t in pairs(expect) do
  local actual = redis.call('TYPE', KEYS[i])['ok']
  if actual ~= 'none' and actual ~= t then return {'ERR', 'WRONG_KEY_TYPE', KEYS[i]} end
end

-- 6. Điểm thưởng đọc từ season Hash (không bao giờ từ request)
local points = 0
if ranked then
  points = tonumber(redis.call('HGET', KEYS[2], 'rankedWinPoints'))
  if not points or points < 0 or points ~= math.floor(points) then return {'ERR', 'INVALID_POINTS'} end
end
local limit = tonumber(cfg[4]) or 100

local wHash, lHash, wStats, lStats
if winner == p1 then wHash, lHash, wStats, lStats = KEYS[5], KEYS[6], KEYS[8], KEYS[9]
else wHash, lHash, wStats, lStats = KEYS[6], KEYS[5], KEYS[9], KEYS[8] end

local scoreBefore = tonumber(redis.call('ZSCORE', KEYS[10], winner)) or 0
local rankBefore = redis.call('ZREVRANK', KEYS[10], winner)

-- ===== Từ đây trở xuống chỉ ghi =====
local scoreAfter = scoreBefore
if ranked then scoreAfter = tonumber(redis.call('ZINCRBY', KEYS[10], points, winner)) end
local rankAfter = redis.call('ZREVRANK', KEYS[10], winner)
local rb = rankBefore and tostring(rankBefore + 1) or ''
local ra = rankAfter and tostring(rankAfter + 1) or ''

redis.call('HSET', KEYS[12],
  'id', matchId, 'seasonId', seasonId, 'mode', mode,
  'player1Id', p1, 'player2Id', p2, 'winnerId', winner, 'loserId', loser,
  'pointsAwarded', points, 'recordedAt', iso, 'recordedAtMs', ms,
  'createdBy', admin, 'requestDigest', digest,
  'winnerScoreBefore', scoreBefore, 'winnerScoreAfter', scoreAfter,
  'winnerRankBefore', rb, 'winnerRankAfter', ra)
redis.call('SADD', KEYS[11], matchId)

redis.call('HINCRBY', wHash, 'totalWins', 1)
redis.call('HINCRBY', lHash, 'totalLosses', 1)
local prefix = ranked and 'ranked' or 'friendly'
redis.call('HINCRBY', wStats, prefix .. 'Wins', 1)
redis.call('HINCRBY', lStats, prefix .. 'Losses', 1)
redis.call('HSET', wStats, 'updatedAt', iso)
redis.call('HSET', lStats, 'updatedAt', iso)

redis.call('LPUSH', KEYS[13], matchId)
redis.call('LTRIM', KEYS[13], 0, limit - 1)
redis.call('ZADD', KEYS[14], ms, matchId)
redis.call('ZADD', KEYS[15], ms, matchId)
redis.call('ZADD', KEYS[16], ms, matchId)

local summary = winner .. ' thắng ' .. loser .. ' (' .. mode .. ', +' .. points .. ')'
redis.call('XADD', KEYS[17], 'MAXLEN', '~', 5000, '*',
  'type', 'match.recorded', 'actorId', admin, 'entityId', matchId, 'occurredAt', iso,
  'summary', summary,
  'metadata', cjson.encode({seasonId = seasonId, mode = mode, winnerId = winner, loserId = loser, pointsAwarded = points}))

return {'OK'}
