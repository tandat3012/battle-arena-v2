-- Đổi điểm thắng Ranked của mùa active, chỉ áp dụng cho trận sau thời điểm đổi (BR-02).
-- KEYS: 1 season:active, 2 season hash   ARGV: 1 seasonId, 2 points, 3 iso
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('HGET', KEYS[2], 'status') ~= 'active' then
  return {'ERR', 'NO_ACTIVE_SEASON'}
end
redis.call('HSET', KEYS[2], 'rankedWinPoints', ARGV[2], 'updatedAt', ARGV[3])
return {'OK'}
