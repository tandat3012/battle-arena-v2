# Kịch bản demo Battle Arena V2

Theo SRS mục 15. Chỉ ghi vào báo cáo những bước đã chạy thật và có ảnh chụp.

## 0. Chuẩn bị (≈2 phút)

```bash
docker compose up --build -d
curl -s localhost:3001/api/health/ready   # ready:true, searchIndex:true, pubsub:true
```

Mở 3 cửa sổ: Web `http://localhost:5173`, Redis Insight `http://localhost:5541`, ARDM (kết nối `127.0.0.1:6380`).

Redis Insight → **Add database** → Host `redis-v2`, Port `6379`, DB 0 (Insight chạy trong cùng network Docker).

## 1. 5 kiểu dữ liệu cơ bản

| Bước | Thao tác trên web | Kiểm chứng trong Redis Insight (Workbench/CLI) |
|---|---|---|
| String + TTL | Đăng nhập `/admin/login` | `SCAN 0 MATCH ba:v2:auth:session:* COUNT 100` → `TTL <key>` đếm ngược. **Che tên key khi chụp ảnh.** |
| Hash + Set | `/admin/players` → Thêm người chơi `player25` | `HGETALL ba:v2:player:player25` · `SISMEMBER ba:v2:players player25` · `ZSCORE ba:v2:season:s2026_02:leaderboard player25` → `0` |
| Ranked | `/admin/matches` → Ranked, player25 thắng player08 | `HGETALL ba:v2:match:<matchId>` · `ZSCORE … player25` → `300` · `ZREVRANK … player25` (+1 = hạng) |
| Sorted Set | `/leaderboard` | `ZRANGE ba:v2:season:s2026_02:leaderboard 0 9 REV WITHSCORES` |
| List | `/history` (chọn "Gần đây") | `LRANGE ba:v2:matches:recent 0 4` — trận mới ở đầu |

## 2. Ranked vs Friendly, chống trùng

1. Ghi trận Ranked → khung "Kết quả xử lý" hiện điểm/hạng trước → sau.
2. Bấm **Gửi lại cùng matchId** → `alreadyProcessed: true`; `ZSCORE` không đổi, `HGET ba:v2:player:<id> totalWins` không đổi.
3. Bấm **Trận mới** → chọn Friendly → ghi: `HGETALL ba:v2:season:s2026_02:stats:<id>` tăng `friendlyWins`, `ZSCORE` giữ nguyên.

## 3. Realtime (Pub/Sub → SSE)

1. Mở `/leaderboard` ở cửa sổ thứ hai (badge **Realtime (SSE)** màu xanh).
2. Redis Insight → **Pub/Sub** → Subscribe channel `ba:v2:leaderboard:changed`.
3. Ghi trận Ranked → message xuất hiện trong Insight; cửa sổ 2 tự cập nhật không F5.

## 4. Nhiều mùa giải

1. `/admin/game` → tab **Season Management** → tạo `s2026_03` (draft).
2. **Kích hoạt** → xác nhận: `s2026_02` bị đóng trong cùng thao tác Lua.
3. Kiểm chứng: `GET ba:v2:season:active` → `s2026_03`; `HGET ba:v2:season:s2026_02 status` → `closed`; `ZRANGE ba:v2:season:s2026_03:leaderboard 0 4 REV WITHSCORES` → toàn 0; bảng `s2026_02` giữ nguyên.

> Bước này đổi dữ liệu demo vĩnh viễn (mùa đóng không mở lại). Chạy `scripts/backup.sh` trước nếu muốn giữ trạng thái cũ.

## 5. Redis Search

- Web: `/players` → Quốc gia VN, Level từ 10 → dòng `FT.SEARCH …` hiển thị đúng query đã gửi.
- Insight Workbench:

```redis
FT.INFO idx:ba:v2:players
FT.SEARCH idx:ba:v2:players '@country:{VN} @level:[10 +inf] @status:{active}'
FT.SEARCH idx:ba:v2:players '@displayName:(kim*)'
```

## 6. Streams, Profiler, Slow Log, Database Analysis

- `XREVRANGE ba:v2:events + - COUNT 5` ↔ khung Activity Logs ở `/admin`.
- **Profiler**: bật → thao tác web (ghi trận) → thấy `EVALSHA`, `HGETALL`, `ZRANGE`… → tắt ngay sau demo.
- **Slow Log**: ghi lại `CONFIG GET slowlog-log-slower-than` trước; nếu tạm đặt `0` để minh họa thì **khôi phục giá trị cũ** và ghi rõ trong báo cáo đây không phải lệnh chậm thật.
- **Database Analysis**: quét, ghi thời điểm quét và số key/kiểu dữ liệu (đối chiếu khung Redis Data Overview ở `/admin`).

## 7. So sánh Redis Insight vs ARDM (cùng Redis V2)

Cùng thời điểm, cùng instance:

| Tiêu chí | Lệnh / thao tác giống nhau trên 2 GUI |
|---|---|
| Kết nối | Insight `redis-v2:6379` · ARDM `127.0.0.1:6380` |
| Duyệt Hash | `ba:v2:player:player01` |
| Top 5 mùa active | `ZRANGE ba:v2:season:s2026_02:leaderboard 0 4 REV WITHSCORES` |
| Sửa field không ảnh hưởng điểm | đổi `level` của 1 người chơi rồi xem trên web `/players/<id>` |

Search, phân tích bộ nhớ, profiler, import/export: ghi `Đã kiểm tra` / `Có trong tài liệu` / `Chưa kiểm tra` đúng thực tế. ARDM là GUI tool, không phải NoSQL DBMS khác.

## 8. Backup / Restore

```bash
scripts/backup.sh
scripts/restore-verify.sh --keep    # instance độc lập ở 127.0.0.1:6381
```

Mở `127.0.0.1:6381` bằng ARDM/Insight để chụp ảnh dữ liệu sau restore; kết quả đối chiếu nằm trong `docs/restore-verification.md`. Dừng: `docker rm -f ba-v2-restore && docker volume rm ba-v2-restore-data`.
