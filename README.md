# Battle Arena V2 — Online Gaming Leaderboard & Management System

Website minh họa cho đồ án **Dữ liệu NoSQL — Redis / Redis Insight**. Redis 8 là CSDL nghiệp vụ **duy nhất**; Redis Insight là công cụ quản trị độc lập (không nằm giữa frontend và backend).

- Nghiệp vụ: [`docs/01_Battle_Arena_V2_De_Tai_Yeu_Cau_Va_Dinh_Huong_Redis.md`](docs/01_Battle_Arena_V2_De_Tai_Yeu_Cau_Va_Dinh_Huong_Redis.md)
- Đặc tả kỹ thuật (key schema, API, test): [`docs/02_Battle_Arena_V2_SRS_Technical_Spec_For_Codex.md`](docs/02_Battle_Arena_V2_SRS_Technical_Spec_For_Codex.md)
- Kịch bản demo + lệnh Redis Insight/ARDM: [`docs/demo-script.md`](docs/demo-script.md)
- Bằng chứng restore lịch sử (cần chạy lại verifier mới): [`docs/restore-verification.md`](docs/restore-verification.md)

## Phiên bản đã chạy thật

| Thành phần | Phiên bản |
|---|---|
| Redis Open Source (có Search) | `redis:8.8.4` — `FT._LIST`, `FT.CREATE`, `FT.SEARCH` đã kiểm chứng |
| Redis Insight | `redis/redisinsight:3.8.0` |
| Node.js / pnpm | 24.x / 12.14 |
| Backend | Express 5.3, node-redis 6.3, zod 4, bcryptjs 3 |
| Frontend | React 19.3, Vite 8.3, React Router 8.5, Tailwind CSS 4.3, lucide-react |
| Test | Vitest 5 + Supertest 7 trên Redis test riêng |

## Cổng (chỉ bind 127.0.0.1)

| Service | URL / host | Ghi chú |
|---|---|---|
| Web | http://localhost:5173 | 5 trang public + 6 trang Admin |
| API | http://localhost:3001/api | Web gọi qua proxy `/api` (cùng origin → cookie HttpOnly) |
| Redis V2 | `127.0.0.1:6380` | ARDM desktop kết nối vào đây |
| Redis Insight | http://localhost:5541 | Thêm database: host **`redis-v2`**, port **`6379`** |
| Redis restore | `127.0.0.1:6381` | Chỉ khi chạy `restore-verify.sh --keep` |
| Redis test | `127.0.0.1:6390` | Profile `test`, bị xóa sạch khi chạy test |

## Chạy lần đầu

Chuẩn bị hash Admin riêng trước khi khởi động:

```bash
pnpm install
pnpm admin-hash --write   # nhập mật khẩu riêng, tối thiểu 8 ký tự
docker compose up --build -d
```

Mở http://localhost:5173; username mặc định là `admin`, mật khẩu là mật khẩu nhóm đã nhập ở bước tạo hash. `.env.example` không chứa thông tin đăng nhập dùng chung; `.env` bị Git bỏ qua. `COOKIE_SECURE=false` chỉ phù hợp với demo HTTP trên máy cá nhân; đặt `COOKIE_SECURE=true` khi chạy qua HTTPS.

### Cách 1 — Toàn bộ trong Docker (dùng khi demo)

```bash
docker compose up --build -d
```

API tự chạy seed idempotent khi khởi động (`SEED_ON_START=true`): lần đầu tạo dữ liệu mẫu, các lần sau thấy marker `ba:v2:seed:version` thì bỏ qua. Không bao giờ `FLUSHDB`.
Nếu seed lỗi, container API dừng khởi động và Docker hiển thị lỗi; hãy xử lý nguyên nhân thay vì coi hệ thống đã sẵn sàng.

### Cách 2 — Dev (hot reload)

```bash
docker compose up -d redis-v2 redisinsight-v2
pnpm init-redis                   # config mặc định + Search index (không ghi đè)
pnpm seed                         # dữ liệu mẫu, chạy lại không nhân đôi
pnpm dev                          # API :3001 (tsx watch) + Web :5173 (Vite)
```

Hai cách dùng chung volume Redis `redis-v2-data`. Đừng chạy song song (trùng cổng 3001/5173).

## Dữ liệu mẫu

24 người chơi (`player01`…`player24`, nhiều quốc gia/level), 2 mùa (`s2026_01` đã đóng, `s2026_02` active), 34 trận Ranked + Friendly. `player23` đã vô hiệu hóa (vẫn còn lịch sử mùa 1); mùa 2 có 3 người đồng 600 điểm để minh họa quy tắc đồng điểm. Heartbeat seed chỉ online trong 120 giây — sau đó bấm **Heartbeat** ở `/admin/players` để có người online.

## Lệnh hữu ích

```bash
pnpm verify-redis                                   # PING, version, FT._LIST, số lượng, top 5 từng mùa, FT.SEARCH mẫu
REDIS_URL=redis://127.0.0.1:6381 pnpm verify-redis  # kiểm tra instance restore
pnpm typecheck                                      # TypeScript cả api + web
```

## Kiểm thử

```bash
docker compose --profile test up -d redis-test
pnpm test
```

Kết quả lịch sử ngày 18/11/2026: **28/28 integration test pass**. Sau các sửa đổi, suite chạy ngày 22/11/2026: **33/33 pass** trên Redis test riêng ở cổng `6390`. Test từ chối chạy nếu `NODE_ENV` không phải `test` hoặc URL không chứa cổng `6390`; Compose định nghĩa Redis test riêng, không dùng chung volume với Redis V2.

| Nhóm | Test (mã theo SRS mục 10) |
|---|---|
| Auth | T02 cookie HttpOnly + session TTL, T03 rate-limit 429 + race song song, T04 không cookie → 401, T05 logout, chặn Origin lạ/request thiếu metadata |
| Người chơi | T07 tạo (Hash + Set + mùa active 0 điểm), T08 trùng ID, T09 sửa + Search index, T10 không sửa được điểm, T11/T12 vô hiệu hóa/kích hoạt lại |
| Mùa giải | Tạo mùa nguyên tử (Set + Hash + Stream, test key sai kiểu và 10 request đồng thời), T13/T14 draft → active (đóng mùa cũ, bảng mới 0 điểm), T15/T23 đóng mùa → chặn ghi trận, T16 bảng cũ giữ nguyên, cấm ID `active` |
| Trận đấu | T17 Ranked, T18 Friendly, T19 retry giống hệt, T20 trùng ID khác winner → 409, T21 người chơi sai, T22 mode tắt, T24 đua với đóng mùa, T25 10 request đồng thời, đổi điểm chỉ áp dụng trận sau |
| Khác | T26/T27 hạng + đồng điểm, T28 FT.SEARCH, T29 cửa sổ online, T30 Stream, T34 che key session, T37 seed idempotent |

Kiểm tra thủ công bằng trình duyệt (headless Brave, 18/11/2026): 11 route ở 1440px và 390px không lỗi JS, không tràn ngang; luồng ghi trận Ranked → tab khác tự cập nhật qua SSE → gửi lại cùng matchId trả `alreadyProcessed: true`, điểm không tăng.

## Backup / Restore

```bash
scripts/backup.sh                 # BGSAVE → copy dump.rdb ra backups/ + .sha256 + .txt
scripts/restore-verify.sh         # nạp RDB vào thư mục tạm/container độc lập, so sánh giá trị các key ba:v2: với nguồn
scripts/restore-verify.sh --keep  # giữ container restore ở 127.0.0.1:6381 để mở bằng ARDM/Redis Insight
```

Redis V2 bật cả AOF (`appendfsync everysec`) và RDB (`infra/redis.conf`). Restore không dùng/xóa Docker volume; script tạo thư mục tạm riêng và chỉ dọn container/thư mục do chính lần chạy đó tạo. Đối chiếu giá trị cần Redis V2 nguồn giữ nguyên từ lúc tạo backup đến hết quá trình so sánh; nếu dữ liệu đã đổi, mismatch là điều dự kiến. File backup bị Git bỏ qua; giữ và nộp riêng theo yêu cầu môn học. Lịch sử 14/0 trong `docs/restore-verification.md` được tạo bởi bản script cũ, chỉ kiểm tra nhiều kết quả không rỗng, nên chưa chứng minh toàn bộ giá trị đã khôi phục.

## Cấu trúc

```text
compose.yaml, .env.example, infra/redis.conf
apps/api/
  src/keys.ts            tên key Redis (nguồn sự thật, SRS 5.2)
  src/lua/*.lua          match-record, login-attempt, player-create, season-create, season-activate, season-close, season-set-points
  src/modules/           players, seasons, matches, leaderboard, online, auth, game, realtime (Pub/Sub→SSE), admin-overview
  src/routes/            public, auth, admin
  scripts/               init-redis, seed (+ seed-data), verify-redis, create-admin-hash
  tests/api.test.ts      integration tests
apps/web/src/
  pages/public/          Dashboard, Leaderboard, Players (+ PlayerDetail), History, Online
  pages/admin/           Login, AdminDashboard, AdminPlayers, AdminMatches, AdminGame, AdminSettings
  components/, layouts/, lib/api.ts
scripts/backup.sh, scripts/restore-verify.sh
docs/                    tài liệu, demo-script, restore-verification, ui-reference/
```

## Khác biệt so với SRS (có chủ đích)

- Script TypeScript nằm ở `apps/api/scripts/` (không ở `scripts/` gốc) để dùng chung dependency và image Docker với API; gọi qua `pnpm init-redis | seed | verify-redis | admin-hash` ở gốc repo.
- Màu giao diện theo bảng màu nhóm chọn (nền đen `#0f0e17`, cam `#ff8906`, đỏ `#f25f4c`, hồng `#e53170`) thay cho tím/xanh gợi ý; Friendly dùng xanh `#2cb67d`, Top 3 vàng/bạc/đồng. Không ảnh hưởng nghiệp vụ.
- Match Hash lưu thêm `winnerScoreBefore/After`, `winnerRankBefore/After` (SRS 6.5 khuyến nghị) để retry trả đúng số liệu của lần xử lý gốc.
- `docs/architecture.md`, `redis-schema.md`, `api-contract.md` không tách riêng: nội dung đã có trong SRS (`docs/02_...md`) và bám đúng khi triển khai.

## Lưu ý

- **Online là mô phỏng**: không có đăng nhập người chơi; trạng thái lấy từ `ba:v2:online:last_seen` (Sorted Set, score = epoch ms) trong cửa sổ cấu hình.
- **Đồng điểm**: thứ tự theo `ZRANGE … REV` của Redis (cùng điểm → playerId lớn hơn theo từ điển đứng trước), không phải đồng hạng thi đấu.
- **Tìm tên**: Redis Search khớp tiền tố từng từ; tên có dấu phải gõ đúng dấu (`nguyễn` khớp, `nguyen` không khớp) — phụ thuộc tokenizer.
- Script Lua `season-activate` ghép tên key bên trong script → chỉ đúng với Redis **standalone** (đủ cho đồ án, không dùng cho Cluster).

## Phần nhóm tự hoàn thành

Ảnh minh chứng Redis Insight (13 mục) và ARDM trên dữ liệu V2, báo cáo Word/PDF, bảng phân công — xem gợi ý thao tác trong `docs/demo-script.md`.
