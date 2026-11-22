# Kết quả kiểm tra phục hồi (restore) — Redis V2

File này do `scripts/restore-verify.sh` tự ghi thêm sau mỗi lần chạy. Không chỉnh tay kết quả.

## Lần kiểm tra 2026-11-18 12:22:46 +0700

- File: `backups/battle-arena-v2-20261118-122115.rdb` (sha256 `d715df149d111401…`)
- Instance restore: `redis:8.8.4`, volume trống `ba-v2-restore-data`, `appendonly no`, cổng 127.0.0.1:6381
- Kết quả: **14 OK / 0 FAIL**

| Trạng thái | Lệnh | Kết quả trên restore | Redis V2 gốc lúc kiểm tra |
|---|---|---|---|
| OK | `PING` | PONG | PONG |
| OK | `INFO server` | redis_version:8.8.4 | redis_version:8.8.4 |
| OK | `SCARD ba:v2:players` | 24 | 24 |
| OK | `SMEMBERS ba:v2:seasons` | s2026_01 s2026_02 | s2026_01 s2026_02 |
| OK | `GET ba:v2:season:active` | s2026_02 | s2026_02 |
| OK | `ZRANGE ba:v2:season:s2026_01:leaderboard 0 4 REV WITHSCORES` | player09 900 player07 600 player01 600 player23 300 player21 300 | player09 900 player07 600 player01 600 player23 300 player21 300 |
| OK | `ZRANGE ba:v2:season:s2026_02:leaderboard 0 4 REV WITHSCORES` | player07 900 player10 600 player09 600 player05 600 player24 300 | player07 900 player10 600 player09 600 player05 600 player24 300 |
| OK | `HMGET ba:v2:player:player01 displayName totalWins totalLosses status` | Nguyễn Văn Minh 3 2 active | Nguyễn Văn Minh 3 2 active |
| OK | `HMGET ba:v2:match:327900b1-9a63-4bb8-b09c-c5c5494b1765 seasonId mode winnerId pointsAwarded` | s2026_02 ranked_1v1 player24 300 | s2026_02 ranked_1v1 player24 300 |
| OK | `SCARD ba:v2:match:ids` | 35 | 35 |
| OK | `LLEN ba:v2:matches:recent` | 35 | 35 |
| OK | `XLEN ba:v2:events` | 73 | 73 |
| OK | `XREVRANGE ba:v2:events + - COUNT 1` | 1794978940679-0 type match.recorded actorId admin entityId 327900b1-9a63-4bb8-b09c-c5c5494b1765 occurredAt 2026-11-18T05:15:40.678Z summary player24 thắng player08 (ranked_1v1, +300) metadata {"winnerId":"player24","loserId":"player08","mode":"ranked_1v1","seasonId":"s2026_02","pointsAwarded":300} | 1794978940679-0 type match.recorded actorId admin entityId 327900b1-9a63-4bb8-b09c-c5c5494b1765 occurredAt 2026-11-18T05:15:40.678Z summary player24 thắng player08 (ranked_1v1, +300) metadata {"winnerId":"player24","loserId":"player08","mode":"ranked_1v1","seasonId":"s2026_02","pointsAwarded":300} |
| OK | `FT.SEARCH idx:ba:v2:players @country:{VN} @level:[10 +inf] @status:{active} NOCONTENT` | 3 ba:v2:player:player19 ba:v2:player:player03 ba:v2:player:player01 | 3 ba:v2:player:player01 ba:v2:player:player19 ba:v2:player:player03 |
