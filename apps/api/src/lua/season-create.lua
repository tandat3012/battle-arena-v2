-- Tạo season draft, đăng ký Set + Hash + Stream trong một lần chạy nguyên tử.
-- KEYS: 1 seasons Set, 2 season Hash, 3 game config Hash, 4 events Stream
-- ARGV: 1 seasonId, 2 name, 3 timestamp ISO, 4 adminId
local id, name, iso, admin = ARGV[1], ARGV[2], ARGV[3], ARGV[4]

-- Kiểm tra toàn bộ kiểu key trước lệnh ghi đầu tiên (Lua không tự rollback).
local expected = { [1] = 'set', [2] = 'hash', [3] = 'hash', [4] = 'stream' }
for i, t in pairs(expected) do
  local actual = redis.call('TYPE', KEYS[i]).ok
  if actual ~= 'none' and actual ~= t then return { 'ERR', 'WRONG_KEY_TYPE' } end
end

if redis.call('SISMEMBER', KEYS[1], id) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then
  return { 'ERR', 'SEASON_EXISTS' }
end

local points = tonumber(redis.call('HGET', KEYS[3], 'defaultRankedWinPoints')) or 300
if points < 0 or points > 10000 or points ~= math.floor(points) then
  return { 'ERR', 'INVALID_POINTS' }
end

-- Ghi Set/Hash/Stream liền nhau; các request Redis khác không thể xen giữa script.
redis.call('SADD', KEYS[1], id)
redis.call('HSET', KEYS[2],
  'id', id,
  'name', name,
  'status', 'draft',
  'rankedWinPoints', points,
  'createdAt', iso,
  'startedAt', '',
  'closedAt', '',
  'updatedAt', iso)
redis.call('XADD', KEYS[4], 'MAXLEN', '~', 5000, '*',
  'type', 'season.created', 'actorId', admin, 'entityId', id,
  'occurredAt', iso, 'summary', 'Tạo mùa ' .. name .. ' (draft)',
  'metadata', cjson.encode({ rankedWinPoints = points }))

return { 'OK', tostring(points) }
