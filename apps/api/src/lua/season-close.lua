-- Đóng mùa đang active và xóa pointer (SRS 7.3). Sau đó không có mùa active → khóa ghi trận.
-- KEYS: 1 season:active, 2 season hash, 3 events   ARGV: 1 seasonId, 2 iso, 3 adminId
local id, iso, admin = ARGV[1], ARGV[2], ARGV[3]
local status = redis.call('HGET', KEYS[2], 'status')
if not status then return {'ERR', 'SEASON_NOT_FOUND'} end
if status ~= 'active' or redis.call('GET', KEYS[1]) ~= id then return {'ERR', 'SEASON_NOT_ACTIVE'} end
redis.call('HSET', KEYS[2], 'status', 'closed', 'closedAt', iso, 'updatedAt', iso)
redis.call('DEL', KEYS[1])
redis.call('XADD', KEYS[3], 'MAXLEN', '~', 5000, '*',
  'type', 'season.closed', 'actorId', admin, 'entityId', id, 'occurredAt', iso,
  'summary', 'Đóng mùa ' .. id, 'metadata', '{}')
return {'OK'}
