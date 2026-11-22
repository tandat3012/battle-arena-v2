-- Kích hoạt mùa draft: đóng mùa active cũ + chuyển pointer + nạp người chơi active với 0 điểm, nguyên tử (SRS 7.3).
-- shortcut: key player/season cũ được ghép trong script (chỉ đúng với Redis standalone, không chạy trên Cluster);
--           đủ cho đồ án 24–50 người chơi, nâng cấp bằng cách tách bước chuẩn bị nếu mở rộng.
-- KEYS: 1 season:active, 2 new season hash, 3 new participants, 4 new leaderboard, 5 players set, 6 events
-- ARGV: 1 newSeasonId, 2 iso, 3 adminId, 4 namespace prefix ('ba:v2:')
local newId, iso, admin, ns = ARGV[1], ARGV[2], ARGV[3], ARGV[4]

local status = redis.call('HGET', KEYS[2], 'status')
if not status then return {'ERR', 'SEASON_NOT_FOUND'} end
if status ~= 'draft' then return {'ERR', 'SEASON_NOT_DRAFT'} end

local old = redis.call('GET', KEYS[1])
if old then
  redis.call('HSET', ns .. 'season:' .. old, 'status', 'closed', 'closedAt', iso, 'updatedAt', iso)
  redis.call('XADD', KEYS[6], 'MAXLEN', '~', 5000, '*',
    'type', 'season.closed', 'actorId', admin, 'entityId', old, 'occurredAt', iso,
    'summary', 'Đóng mùa ' .. old .. ' (do kích hoạt ' .. newId .. ')', 'metadata', cjson.encode({nextSeasonId = newId}))
end

local joined = 0
for _, pid in ipairs(redis.call('SMEMBERS', KEYS[5])) do
  if redis.call('HGET', ns .. 'player:' .. pid, 'status') == 'active' then
    redis.call('SADD', KEYS[3], pid)
    redis.call('ZADD', KEYS[4], 'NX', 0, pid)
    joined = joined + 1
  end
end

redis.call('HSET', KEYS[2], 'status', 'active', 'startedAt', iso, 'updatedAt', iso)
redis.call('SET', KEYS[1], newId)
redis.call('XADD', KEYS[6], 'MAXLEN', '~', 5000, '*',
  'type', 'season.activated', 'actorId', admin, 'entityId', newId, 'occurredAt', iso,
  'summary', 'Kích hoạt mùa ' .. newId .. ' với ' .. joined .. ' người chơi', 'metadata', cjson.encode({previousSeasonId = old or '', participants = joined}))
return {'OK', old or '', tostring(joined)}
