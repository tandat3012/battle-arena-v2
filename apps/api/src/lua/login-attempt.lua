-- Tăng bộ đếm đăng nhập sai nguyên tử, giới hạn số lần được ghi nhận trong cửa sổ.
-- KEYS: 1 login attempts String; ARGV: 1 maximum, 2 window seconds
local maxAttempts = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', KEYS[1])) or 0
if current >= maxAttempts then
  return { 'LIMIT', tostring(redis.call('TTL', KEYS[1])) }
end

local next = redis.call('INCR', KEYS[1])
if next == 1 or redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], window) end
return { 'COUNT', tostring(next) }
