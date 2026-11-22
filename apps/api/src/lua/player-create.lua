-- Tạo người chơi nguyên tử (SRS 7.1): Set + Hash + (tham gia mùa active với 0 điểm) + Stream.
-- KEYS: 1 players set, 2 player hash, 3 season:active, 4 events,
--       [5 participants, 6 leaderboard] — chỉ truyền khi API thấy có mùa active
-- ARGV: 1 id, 2 displayName, 3 country, 4 level, 5 iso, 6 expectedActiveSeason ('' nếu không có), 7 adminId
local id, name, country, level, iso, expected, admin = ARGV[1], ARGV[2], ARGV[3], ARGV[4], ARGV[5], ARGV[6], ARGV[7]

if redis.call('SISMEMBER', KEYS[1], id) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then
  return {'ERR', 'PLAYER_EXISTS'}
end
-- Mùa active đổi giữa lúc API đọc và lúc script chạy → API thử lại với key đúng
local active = redis.call('GET', KEYS[3]) or ''
if active ~= expected then return {'ERR', 'RETRY'} end

redis.call('SADD', KEYS[1], id)
redis.call('HSET', KEYS[2], 'id', id, 'displayName', name, 'country', country, 'level', level,
  'status', 'active', 'totalWins', 0, 'totalLosses', 0, 'createdAt', iso, 'updatedAt', iso)
if active ~= '' then
  redis.call('SADD', KEYS[5], id)
  redis.call('ZADD', KEYS[6], 'NX', 0, id)
end
redis.call('XADD', KEYS[4], 'MAXLEN', '~', 5000, '*',
  'type', 'player.created', 'actorId', admin, 'entityId', id, 'occurredAt', iso,
  'summary', 'Tạo người chơi ' .. name, 'metadata', cjson.encode({country = country, level = tonumber(level), seasonId = active}))
return {'OK', active}
