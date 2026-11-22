# BATTLE ARENA V2 — SOFTWARE REQUIREMENTS SPECIFICATION (SRS) & TECHNICAL IMPLEMENTATION CONTRACT

> **Đối tượng đọc:** Codex / AI coding agent, frontend, backend, database, QA.  
> **Ngôn ngữ dự án:** Giao diện và README tiếng Việt; định danh code, API, tên key Redis bằng tiếng Anh.  
> **Tình trạng:** Đặc tả cho hệ thống **chưa triển khai**. Không đánh dấu hoàn thành trước khi có code chạy và test.  
> **Ngày chốt:** 17/11/2026; hạn nộp 24/11/2026.  
> **Tài liệu nghiệp vụ bắt buộc đọc trước:** `01_Battle_Arena_V2_De_Tai_Yeu_Cau_Va_Dinh_Huong_Redis.md`.  
> **Ưu tiên xung đột:** Quy tắc nghiệp vụ ở tài liệu 01 là nguồn sự thật; tài liệu 02 quy định chi tiết **cách triển khai**. Khi thay đổi phải sửa đồng bộ cả hai; không tự ý đơn giản hóa mất yêu cầu.

---

# 0. CHỈ THỊ TRIỂN KHAI CHO CODEX

**Nhiệm vụ:** Xây dựng **website Battle Arena V2 thực sự chạy** từ một repository có thể dựng lại bằng Docker Compose, dùng **Redis làm datastore chính và duy nhất cho dữ liệu nghiệp vụ**, Redis Insight để quản trị, ARDM làm GUI so sánh, React frontend, Express backend. Thiết kế và triển khai theo SRS này, không tạo giao diện giả với dữ liệu hardcode.

1. Đọc hai file `.md` từ đầu đến cuối; ghi lại checklist các yêu cầu `FR`, `BR`, `NFR`, `AC`.
2. Nếu repository hiện có, **kiểm tra cấu trúc/source trước**, không xóa code tùy tiện và **không đụng Redis V1**. Tạo dự án V2 trong thư mục/namespace độc lập.
3. Tổ chức code theo modules và thực hiện theo mốc: infrastructure → Redis models/seed → auth → seasons/players → matches atomic → public UI → Admin UI → advanced Redis → backup/tests/docs.
4. Mỗi bước phải chạy linter, unit/integration tests phù hợp; không ghi “pass” nếu chưa thực thi.
5. Không đổi 11 trang chính; **không thêm player login**; không dùng PostgreSQL/MongoDB/SQLite làm DB chính; không thay thế Redis Search/Stream bằng mảng JS giả.
6. Nếu vướng thư viện, image hoặc API phiên bản thực tế, xác minh tài liệu Redis chính thức rồi chọn **phiên bản tương thích đã kiểm chứng**, ghi version vào README; không tự đoán cú pháp/chức năng.
7. Không yêu cầu lại những quyết định đã khóa ở SRS: Ranked +300/0, Friendly +0 score, 2 chế độ, 1 game, season riêng, soft-delete, chỉ Admin login, heartbeat mô phỏng.
8. Trả về dự án chạy được, hướng dẫn chạy, script demo, seed, backup/restore, bảng chức năng hoàn thành, test thực tế, lưu ý vấn đề chưa hoàn thành. **Ưu tiên chạy đúng hơn làm UI trang trí.**

---

# 1. TỔNG QUAN VÀ ĐỊNH NGHĨA

## 1.1. Sản phẩm

**Battle Arena V2** — hệ thống quản lý bảng xếp hạng trò chơi trực tuyến, mô phỏng trận 1v1, nhiều mùa giải. Một ứng dụng thật, không phải game đồ họa. Redis là nguồn dữ liệu chính. Redis Insight là công cụ quản trị độc lập.

## 1.2. Giới hạn phiên bản bàn giao

| ID | Phạm vi | Mức |
|---|---|---|
| P0 | 11 trang + API thật + dữ liệu Redis + CRUD player + mùa + Ranked/Friendly + idempotent match + auth + history + backup | **Bắt buộc** |
| P1 | Search theo tên/field, Pub/Sub→SSE, Stream Activity Logs, Redis Data Overview, TTL/rate-limit và minh chứng Redis Insight | **Ưu tiên rất cao** — thuộc phạm vi đã thống nhất |
| P2 | Biểu đồ nâng cao/hiệu ứng UI/giãn cỡ dữ liệu/analytics chi tiết | Bổ sung sau P0/P1 |
| OUT | Game đồ họa, multiplayer, player account/login, sản phẩm thương mại, thanh toán, nhiều game, Redis Cluster, thủ công thay điểm | Ngoài phạm vi |

**Không được cắt P1 âm thầm** nếu P0 gặp khó; phải ghi rõ phần nào chưa hoàn thành và lý do, dù vẫn ưu tiên P0 để kịp hạn.

## 1.3. Vai trò

- `PUBLIC`: không đăng nhập, chỉ GET public; không biết Redis credentials.
- `ADMIN`: một hoặc vài quản trị viên có session; mọi thao tác ghi thông qua backend được bảo vệ; tài khoản admin tối thiểu được thiết lập từ cấu hình bí mật khi dựng môi trường.
- `REDIS_OPERATOR` (ngoài website): dùng Redis Insight/ARDM qua kết nối riêng; không phải vai trò API hoặc account người chơi.

## 1.4. Quy ước thời gian & ID

- Tất cả timestamp lưu **UTC ISO 8601** trong Hash hoặc số epoch milliseconds khi làm score thời gian trong Sorted Set; UI định dạng theo múi giờ `Asia/Ho_Chi_Minh`.
- ID `playerId`: `[a-zA-Z0-9_-]{3,40}`; ví dụ `player01`. ID `seasonId`: `[a-zA-Z0-9_-]{3,40}`; ví dụ `s2026_01`, **cấm giá trị dự trữ `active`** để không đụng `ba:v2:season:active`. `matchId`: UUID v4 do client tạo rồi server validate, dùng làm idempotency key.
- Định danh chỉ tạo và xác nhận ở backend; không ghép tên key Redis từ chuỗi bất kỳ chưa validate.
- `score`: số nguyên **không âm**. `pointsAwarded`: số nguyên. `level`: số nguyên từ 1 đến 100. `country`: mã 2 chữ cái theo quy ước demo; không bắt buộc thư viện ISO đầy đủ.
- Tên enum chính xác trong API: `ranked_1v1`, `friendly_1v1`; `draft`, `active`, `closed`; `active`, `inactive`.

---

# 2. KIẾN TRÚC CỐ ĐỊNH

```text
Browser React SPA (Vite, TypeScript, Tailwind CSS)
     │
     ├── GET /api/public/*   (không auth)
     ├── /api/auth/*         (cookie/session)
     ├── /api/admin/*        (admin middleware)
     └── EventSource /api/public/events/leaderboard (SSE)
                     │
                     ▼
             Express API (Node.js + TypeScript)
             ├─ routing + zod validation
             ├─ auth + cookie + rate limiter
             ├─ domain services (players, matches, seasons, stats)
             ├─ Redis repository (node-redis)
             ├─ atomic Lua scripts (critical multi-key operations)
             ├─ Pub/Sub bridge -> SSE
             └─ event logger -> Redis Stream
                     │
                     ▼
              Redis Open Source 8.x
              ├─ String / Hash / List / Set / Sorted Set
              ├─ Search index (FT.CREATE / FT.SEARCH)
              ├─ Pub/Sub + Streams + Lua
              └─ AOF + RDB (snapshot)

Redis Insight (GUI, Docker) ─┐
                            ├── cùng Redis V2 server, riêng đường quản trị
ARDM (GUI, desktop) ───────┘
```

**Không truyền Redis host/password tới bundle frontend.** Redis Insight không thực thi thay backend. **Không cho chạy `FLUSHDB`, `FLUSHALL`, `CONFIG`, `EVAL` tuỳ ý từ UI Admin.**

## 2.1. Stack triển khai

- **Frontend:** React, Vite, TypeScript, React Router, Tailwind CSS, thư viện icon nhẹ; fetch client có `credentials: 'include'`.
- **Backend:** Node.js LTS phù hợp, Express + TypeScript, `redis` (node-redis), `zod` validation, password hashing `bcrypt` hoặc `argon2`, cookie parser, middleware bảo mật, logging có lọc secret.
- **Test:** Vitest cho unit/business rules; Supertest cho API integration; có Redis test instance riêng (Docker test service) cho test critical; test trình duyệt bằng Playwright nếu khả thi.
- **Deploy local:** Docker Compose, chạy tối thiểu `web`, `api`, `redis-v2`, `redisinsight-v2`; volume Redis riêng. Không dùng `latest` một cách mù quáng: chọn/tag phiên bản phù hợp, kiểm chứng lệnh Search ở startup, ghi version chạy thật vào README.
- **Redis:** ưu tiên Redis Open Source **8.x** có Redis Search; verify `FT._LIST` và thực thi `FT.CREATE` trên môi trường triển khai. Nếu Image bản chọn không có Search, đổi image/cấu hình **trước khi coi startup thành công**.

## 2.2. Cổng mặc định tránh đụng môi trường giữa kỳ

| Service | Bên trong Docker | Máy host đề xuất | Chú ý |
|---|---|---|---|
| `web` | `5173` (dev) hoặc cổng web container | `127.0.0.1:5173` | Trình duyệt mở tại `http://localhost:5173` |
| `api` | `3000` | `127.0.0.1:3001` (nếu expose) | Client web dùng proxy `/api` |
| `redis-v2` | `6379` | `127.0.0.1:6380` | ARDM desktop kết nối localhost:6380; backend dùng `redis-v2:6379` |
| `redisinsight-v2` | `5540` | `127.0.0.1:5541` | Mở GUI `http://localhost:5541`; kết nối host `redis-v2`, port `6379` |

Không expose Redis/Redis Insight ra Internet. Có thể override cổng qua `.env`, nhưng các hướng dẫn/demo phải dùng đúng cổng đã cấu hình. Tất cả service cùng network Docker; healthcheck Redis và dependency readiness cho API.

## 2.3. Cấu hình và bí mật

`.env.example` có **placeholder** và mô tả `REDIS_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_TTL_SECONDS=28800`, `COOKIE_SECURE=false` (chỉ localhost HTTP), `APP_ORIGIN`, các cổng host, log level. `.env` thật phải nằm trong `.gitignore`. Thêm script CLI tạo password hash từ mật khẩu nhập an toàn (không in password). **Không tạo tài khoản Admin dùng password cố định công khai trong mã nguồn.**

---

# 3. DANH SÁCH 11 TRANG, COMPONENT VÀ ROUTE

## 3.1. Public — đúng 5 trang

| ID | UI route | Yêu cầu chức năng | Loading/empty/error |
|---|---|---|---|
| `UI-P01` | `/` | Tổng player, trận, online mô phỏng, Top 3, recent matches; chọn mùa có leaderboard | Có |
| `UI-P02` | `/leaderboard` | Chọn season, Top 5/10/all, rank/score/wins/losses, lọc khoảng điểm, tìm player, SSE refresh | Có |
| `UI-P03` | `/players` | Danh sách, lọc tên/quốc gia/level/status qua Search, phân trang; `/players/:id` là **route con** không tính trang chính | Có |
| `UI-P04` | `/history` | Danh sách trận theo mùa, mode, player, cursor pagination, xem match detail dưới dạng modal/route con | Có |
| `UI-P05` | `/online` | Danh sách player có heartbeat mô phỏng trong 120s (hoặc cấu hình), last seen; ghi rõ không phải online thật | Có |

## 3.2. Admin — đúng 6 trang (có login)

| ID | UI route | Chức năng | Yêu cầu bảo vệ |
|---|---|---|---|
| `UI-A01` | `/admin/login` | Form username/password, lỗi rate-limit, redirect sau login | Không yêu cầu auth lúc mở |
| `UI-A02` | `/admin` | Stats, Redis Data Overview read-only, Activity Logs từ Streams | Chỉ ADMIN |
| `UI-A03` | `/admin/players` | CRUD mềm player, form thêm/sửa, active/inactive, mô phỏng heartbeat | Chỉ ADMIN |
| `UI-A04` | `/admin/matches` | Ghi trận theo mùa active, chọn mode và winner; preview điểm; hiển thị kết quả trước/sau; xử lý retry an toàn | Chỉ ADMIN |
| `UI-A05` | `/admin/game` | Meta game, bật/tắt mode; **tab Seasons** tạo/kích hoạt/đóng và xem mùa | Chỉ ADMIN |
| `UI-A06` | `/admin/settings` | Điểm thắng mùa active, điểm mặc định mùa mới, online window, recent history limit | Chỉ ADMIN |

**Cấu trúc UI:** layout Public với top nav; layout Admin với sidebar. Admin routes không render nội dung bảo mật khi session hết hạn, chuyển về login. UI luôn xác nhận đóng season/vô hiệu hóa player và không cho bấm thao tác nguy hiểm khi API đang xử lý.

## 3.3. UI thiết kế và khả năng truy cập

- Dark esports theme, card thống kê, bảng dễ đọc, highlight Top 3, màu phân biệt Ranked/Friendly.
- Hỗ trợ desktop 1440/1024 và mobile 390 px không vỡ layout; bảng có scroll ngang khi cần.
- Form có label, validation feedback, phân biệt `loading`, `empty`, `error`, `success`; toast không che lỗi chi tiết.
- Không dùng ảnh stock làm bằng chứng chức năng. Trên Admin Redis Data Overview hiển thị mô tả các cấu trúc, key ví dụ **đã che thông tin nhạy cảm**, số lượng thực tế từ API.
- Không hiển thị “realtime” nếu SSE chưa hoạt động thật; trạng thái online phải ghi *mô phỏng*.

---

# 4. QUY TẮC NGHIỆP VỤ CHI TIẾT (`BR`)

## BR-01 — Một game, hai mode

`ranked_1v1`: thắng **+300 điểm mặc định**, thua **0 điểm**; `friendly_1v1`: thắng/thua vẫn được thống kê nhưng **không thay đổi điểm xếp hạng**. Backend quyết định `pointsAwarded`; frontend không gửi số điểm tuỳ ý làm nguồn sự thật. Mode disabled => API ghi trận trả lỗi `409 MODE_DISABLED`.

## BR-02 — Season state machine

- `draft → active → closed`. Có thể có **0 hoặc 1 active**, không bao giờ có 2.
- Chỉ **active** cho phép ghi trận. `draft` chưa có trận, `closed` bất biến về điểm, thống kê và kết quả.
- `ba:v2:season:active` là **String key duy nhất** lưu ID active, hoặc không tồn tại nếu không có mùa active; không lưu bản sao activeSeasonId dễ lệch trong game Hash.
- Mỗi season có `leaderboard` Sorted Set riêng; khi active, tất cả player `active` đã có được thêm với score 0; player mới tạo khi có mùa active cũng tham gia với score 0. Không tự sao chép điểm mùa cũ.
- Kích hoạt season mới phải **đóng mùa active cũ và chuyển pointer trong một thao tác nguyên tử**; `closed` không thể kích hoạt lại. Đóng mùa active không kích hoạt mùa khác để trống pointer thì không cho ghi trận.
- Season mới được tạo với `rankedWinPoints` lấy từ default settings; Admin có thể chỉnh `rankedWinPoints` **chỉ khi season active**, áp dụng cho trận tương lai; match cũ giữ `pointsAwarded` bất biến.

## BR-03 — Player lifecycle

- Tạo player active, ID duy nhất; thuộc `ba:v2:players`. Hash player chứa hồ sơ và tổng thắng/thua.
- Chỉ player status `active` mới có thể tham gia trận hoặc được simulate heartbeat.
- `inactive` (soft-delete) giữ nguyên Hash, lịch sử, leaderboard và thống kê season; hiển thị badge `Đã vô hiệu hóa`.
- Không expose hard delete player/match trong API V2. Bảo tồn lịch sử của season đã đóng.
- ID không được tái sử dụng sau khi vô hiệu hóa.

## BR-04 — Ranked board

- Điểm nguồn sự thật của từng mùa là `ba:v2:season:<seasonId>:leaderboard` (Sorted Set).
- Mọi rank được tính từ `ZREVRANK + 1`; không lưu `rank` trong Hash. `null` nếu không có member.
- Đồng điểm được sắp theo thứ tự nội bộ Redis Sorted Set khi đọc giảm dần: với member IDs cùng score, Redis có thứ tự từ điển đảo ở chiều descending; không dùng cùng số thứ hạng cho người đồng điểm.
- `top=5`, `top=10`, `all` có pagination; không lấy toàn bộ ZSet vô hạn trong API production.

## BR-05 — Recording match exactly once

- `POST /api/admin/matches` nhận `{ matchId, seasonId, mode, player1Id, player2Id, winnerId }`, **không** nhận `pointsAwarded` như giá trị tin cậy.
- Backend tính `loserId` từ 2 player, validate `winnerId` là một trong hai, player IDs khác nhau, both active, seasonId trùng active pointer, mode enabled.
- Redis Lua (hoặc giao dịch có bảo đảm nguyên tử tương đương, nhưng **mặc định triển khai Lua**) làm một commit: **chống trùng matchId**, lưu Hash match, cập nhật season + all-time wins/losses, cộng `ZINCRBY` chỉ cho Ranked, thêm danh sách gần đây, thêm index match theo mùa/player, thêm Stream event.
- Nếu cùng `matchId` + payload nghiệp vụ **giống hệt** → `200 alreadyProcessed:true` kèm match cũ; **không** tăng lần 2. Nếu trùng ID nhưng payload khác → `409 MATCH_ID_CONFLICT`.
- Bản ghi match **bất biến** sau khi tạo, không có API sửa/xóa.
- Không phụ thuộc vào clock gửi từ client, sử dụng thời gian backend/Redis khi ghi. Tính nhất quán quan trọng hơn hiển thị đồng hồ realtime.

## BR-06 — Event/online/auth

- Online là **mô phỏng** bằng cập nhật `lastSeen` trong Redis ZSet. Cửa sổ 120s mặc định; hết thời gian → offline khi truy vấn. Không tạo tính năng đăng nhập player chỉ để giả danh online thật.
- Admin session dùng String + TTL 8h mặc định, token ngẫu nhiên và cookie `HttpOnly`; logout xóa key. Đăng nhập sai có giới hạn lượt theo cửa sổ thời gian.
- Một trận ghi thành công sẽ tạo sự kiện trong Redis Stream; **backend phát Pub/Sub sau commit**; các trình duyệt qua SSE sẽ fetch lại Redis (SSE chỉ làm tín hiệu invalidation).

## BR-07 — Settings

- Cấu hình game và mode quản lý ở `Game Management`.
- `defaultRankedWinPoints` ở Settings áp dụng **khi tạo season mới**.
- `activeSeasonRankedWinPoints` (nếu chỉnh) áp dụng cho **trận Ranked tương lai** của mùa đang active, không cập nhật match cũ.
- `onlineWindowSeconds` mặc định 120 (cho phép 30..3600); `recentHistoryLimit` mặc định 100 (cho phép 20..500). Không cho người dùng sửa file Redis config trong website.

---

# 5. DATA DICTIONARY VÀ REDIS KEY SCHEMA — SOURCE OF TRUTH

## 5.1. Namespace và nguyên tắc

- **Tất cả key nghiệp vụ** trong namespace `ba:v2:`. Không đụng key V1 `game:*`.
- Một Redis V2 container/volume riêng; database index `0` trên instance riêng. Tránh coi `SELECT 1` trong cùng instance là giải pháp phân tách hoàn toàn.
- Key names chỉ được xây từ ID validate; field `score` chỉ lưu trong Sorted Set leaderboard, **không duplicate trong player Hash**.
- Giữ `version` trong data seed marker và schema metadata; tránh migration phá dữ liệu cũ.
- Dấu `:` chỉ là quy ước đặt tên, không tạo JOIN/foreign key. Các tham chiếu ID phải được backend kiểm tra.
- Redis standalone cho bản đồ án; không khẳng định scripts nhiều key sẵn sàng cho Redis Cluster vì có yêu cầu hash slot.

## 5.2. Danh mục key (đúng tên trừ các placeholder)

| Key hoặc pattern | Type | Nội dung/điều kiện |
|---|---|---|
| `ba:v2:game:config` | **Hash** | `name`, `description`, `status` (`active`/`maintenance`), `defaultRankedWinPoints`, `onlineWindowSeconds`, `recentHistoryLimit`, `rankedEnabled`, `friendlyEnabled`, `updatedAt` |
| `ba:v2:players` | **Set** | Tất cả playerId đã từng được tạo, kể cả inactive |
| `ba:v2:player:<playerId>` | **Hash** | `id`, `displayName`, `country`, `level`, `status`, `totalWins`, `totalLosses`, `createdAt`, `updatedAt` |
| `ba:v2:seasons` | **Set** | Tất cả seasonId |
| `ba:v2:season:active` | **String** | seasonId active (không có key = không có mùa active) |
| `ba:v2:season:<seasonId>` | **Hash** | `id`, `name`, `status`, `rankedWinPoints`, `createdAt`, `startedAt`, `closedAt`, `updatedAt` |
| `ba:v2:season:<seasonId>:participants` | **Set** | Các playerId từng tham gia mùa (không xóa khi player inactive) |
| `ba:v2:season:<seasonId>:leaderboard` | **Sorted Set** | member = playerId; score = điểm Ranked trong mùa, default 0 |
| `ba:v2:season:<seasonId>:stats:<playerId>` | **Hash** | `rankedWins`, `rankedLosses`, `friendlyWins`, `friendlyLosses`, `updatedAt` |
| `ba:v2:match:ids` | **Set** | Các matchId đã ghi nhận |
| `ba:v2:match:<matchId>` | **Hash** | `id`, `seasonId`, `mode`, `player1Id`, `player2Id`, `winnerId`, `loserId`, `pointsAwarded`, `recordedAt`, `recordedAtMs`, `createdBy`, `requestDigest` |
| `ba:v2:matches:recent` | **List** | ID trận mới nhất ở đầu, `LPUSH` + `LTRIM` theo `recentHistoryLimit` |
| `ba:v2:season:<seasonId>:matches` | **Sorted Set** | member matchId; score `recordedAtMs`, dùng phân trang theo mùa |
| `ba:v2:player:<playerId>:matches` | **Sorted Set** | member matchId; score `recordedAtMs`, dùng lọc lịch sử theo player |
| `ba:v2:online:last_seen` | **Sorted Set** | member playerId; score = epoch ms ping mô phỏng gần nhất |
| `ba:v2:auth:session:<sha256(token)>` | **String + TTL** | Giá trị ID admin; `EX` theo session duration; **không hiện key trong UI overview** |
| `ba:v2:auth:login:attempts:<digest>` | **String + TTL** | Counter `INCR` / `EXPIRE`, chống thử password liên tục |
| `ba:v2:events` | **Stream** | Activity event `type`, `actorId`, `entityId`, `occurredAt`, `summary`, `metadata` (metadata JSON an toàn) |
| `ba:v2:seed:version` | **String** | Marker idempotent seed, ví dụ `v2-seed-1` |
| `idx:ba:v2:players` | **Redis Search index** | Secondary index của các `ba:v2:player:*` kiểu Hash; không nhầm với key dữ liệu thường |
| `ba:v2:leaderboard:changed` | **Pub/Sub channel** | Channel thông báo — **không phải key lưu dữ liệu** |

### Lưu ý quan trọng về prefix key

`ba:v2:player:<playerId>` cũng dùng tiền tố giống `ba:v2:player:<playerId>:matches` (Sorted Set). Redis Search dùng `ON HASH` nên không index Sorted Set, nhưng repository phải biết rõ loại key để tránh `WRONGTYPE`. Không dùng `KEYS ba:v2:*` trên đường API; để tổng hợp key dùng `SCAN` theo cursor với quyền và giới hạn hợp lý.

## 5.3. Quy tắc bảo toàn dữ liệu

- **Hồ sơ, danh sách player và participant:** không có player ID ma; không ghi match cho inactive.
- **Leaderboard:** mỗi participant khi mùa active có member score 0 trở lên; người đã inactive có thể giữ điểm để lưu lịch sử.
- **Match:** mỗi matchId đúng một Hash, thuộc 1 mùa, đúng 2 player và một kết quả; `ba:v2:match:ids` chứa ID đó.
- **History:** Index theo mùa/player và recent list là dữ liệu để truy cập nhanh, phải cập nhật cùng sự kiện ghi trận.
- **Counters:** `totalWins/totalLosses` và season stats là các chỉ số dẫn xuất được cập nhật khi commit; có test so với tập match seed để tìm lệch. Không chỉnh chúng bằng API hồ sơ thông thường.
- **Có dữ liệu cũ:** không tự động xóa key, không tự động `FLUSHDB` khi restart, đổi mùa, seed hay kiểm thử.

## 5.4. Redis Search index

Ví dụ lệnh khởi tạo schema (chạy một lần, kiểm tra tồn tại trước khi tạo):

```redis
FT.CREATE idx:ba:v2:players ON HASH PREFIX 1 "ba:v2:player:" SCHEMA displayName TEXT country TAG level NUMERIC SORTABLE status TAG
```

Ví dụ tìm người VN cấp >= 10:

```redis
FT.SEARCH idx:ba:v2:players '@country:{VN} @level:[10 +inf] @status:{active}'
```

- Tạo index từ migration/setup script, kiểm tra `FT._LIST` trước. Search ở API `GET /api/public/players` dùng index thật, có escape các giá trị query input và phân trang (LIMIT). **Không im lặng quét `SMEMBERS` rồi lọc JS và gọi đó là Redis Search.**
- `displayName TEXT`: hỗ trợ tìm tên; phải kiểm thử cả tên có khoảng trắng/Unicode, hướng dẫn rằng kết quả phụ thuộc tokenizer và quy tắc search thực tế.
- Không xây index tính điểm trong player Hash: lọc score theo **Sorted Set của season** rồi join hồ sơ theo playerId ở backend; tránh hai nguồn score.
- Một số phiên bản Redis cũ/không đủ module có thể thiếu `FT.CREATE`; setup phải báo lỗi rõ hoặc thay image, không hiển thị chức năng Search giả.

---
# 6. HỢP ĐỒNG API — REST + SSE

## 6.1. Phản hồi chuẩn

Trả JSON, ngoại trừ SSE và health endpoint nếu cần. Không trả raw Redis replies ra frontend.

**Success:**

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "uuid-or-short-id" }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "MATCH_ID_CONFLICT",
    "message": "Mã trận đã được dùng cho kết quả khác.",
    "details": {}
  },
  "meta": { "requestId": "uuid-or-short-id" }
}
```

- `400` yêu cầu sai định dạng; `401` chưa login/hết phiên; `403` thiếu quyền; `404` không có đối tượng; `409` trạng thái nghiệp vụ xung đột; `422` dữ liệu đúng cú pháp nhưng không hợp lệ; `429` quá số lần; `500` lỗi nội bộ, không leak credentials/stack trace.
- List APIs: có `items`, `total` khi xác định được, `page/pageSize` hoặc `nextCursor`. Mặc định `pageSize=20`, tối đa 100.
- Timestamps ISO UTC; `rank` hiển thị bắt đầu 1; `score` nguyên; `pointsAwarded=0` cho Friendly.
- Các GET public phải không trả `requestDigest`, `createdBy` hoặc thông tin session/password. Admin match details có thể trả thêm `createdBy` nếu cần.

## 6.2. API công khai — không cần đăng nhập

| Method | Route | Input | Output/yêu cầu |
|---|---|---|---|
| GET | `/api/public/game` | — | Tên game, mô tả, trạng thái và mode đã bật (không lộ secret) |
| GET | `/api/public/seasons` | `status?` | Danh sách mùa và ID mùa active |
| GET | `/api/public/dashboard` | `seasonId?` | `totalPlayers`, `totalMatches`, `simulatedOnlineCount`, `top3`, `recentMatches`, `selectedSeason` |
| GET | `/api/public/leaderboard` | `seasonId?`, `limit?=10`, `page?`, `minScore?`, `maxScore?`, `q?` | PlayerId, name, score, rank (1-based), wins/losses mùa, status; đúng mùa chọn |
| GET | `/api/public/players` | `q?`, `country?`, `minLevel?`, `maxLevel?`, `status?`, `page?`, `pageSize?` | Danh sách player Search index thật |
| GET | `/api/public/players/:id` | `seasonId?` | Hồ sơ, tổng thành tích, thành tích mùa, score/rank mùa, recent matches |
| GET | `/api/public/matches` | `seasonId?`, `mode?`, `playerId?`, `cursor?`, `limit?` | Lịch sử theo thời gian mới nhất; nếu lọc player phải dùng player match index |
| GET | `/api/public/matches/:id` | — | Chi tiết trận, người thắng/thua, điểm, mùa, mode |
| GET | `/api/public/online` | `limit?` | Danh sách online **mô phỏng** theo lastSeen và window hiện hành |
| GET | `/api/public/events/leaderboard` | `seasonId?` | `text/event-stream`; thông báo `{type:'leaderboard.changed',seasonId,matchId}`; client tự refetch data |

**Leaderboard lọc điểm và từ khóa:** API vẫn phải tính rank theo toàn bộ leaderboard của mùa trước khi trả danh sách lọc, không đánh lại rank từ 1 trên kết quả lọc. Có thể lọc điểm trên ZSet bằng `ZRANGE ... BYSCORE REV` hoặc lọc sau khi đọc trang điểm phù hợp và join Hash; kiểm thử trên dataset nhỏ trước. Nếu `q` tìm tên, dùng Redis Search để lấy IDs kết hợp với Sorted Set season; nêu rõ quy tắc giao nhau, phân trang và `total`. Không dùng `SMEMBERS` không giới hạn cho dữ liệu lớn.

**Tính số trận:** `SCARD ba:v2:match:ids`. Số người chơi tổng: `SCARD ba:v2:players` (kể cả inactive); phải đặt label đúng là “Tổng hồ sơ người chơi”. Không dùng `DBSIZE` để thay số người chơi. Số người online: `ZCOUNT ba:v2:online:last_seen <nowMs-windowMs> +inf` nhưng cần loại người inactive nếu không có bước dọn, hoặc giao điểm với active player khi trả danh sách.

## 6.3. Auth API

| Method | Route | Body | Output |
|---|---|---|---|
| POST | `/api/auth/login` | `{username,password}` | Set cookie session HTTP-only; trả admin profile tối thiểu |
| GET | `/api/auth/me` | cookie | `{authenticated:true,admin:{id,username}}` hoặc 401 |
| POST | `/api/auth/logout` | cookie | Xóa session Redis, clear cookie; idempotent |

- Cookie `HttpOnly`, `SameSite=Lax`, `Secure=true` trên HTTPS; local HTTP chỉ `Secure=false` theo `.env`. Trong production cấu hình reverse proxy đúng và có CSRF protection thích hợp cho các route ghi; tối thiểu validate Origin và dùng anti-CSRF token hoặc giải pháp tương đương khi có cookie.
- Dùng token crypto random >= 32 bytes, **chỉ lưu SHA-256 digest làm phần tên Redis key**, không ghi raw token vào log, Redis Insight screenshots hay Admin Overview.
- Trên login thất bại `INCR` attempts key theo digest IP/username và `EXPIRE` (counter có TTL); ngưỡng gợi ý 5 lần/15 phút, trả `429`; rate limit cả ở endpoint login. Không tạo account mặc định mật khẩu công khai.

## 6.4. API Admin — tất cả yêu cầu session ADMIN

| Method | Route | Body/Query | Chức năng |
|---|---|---|---|
| GET | `/api/admin/dashboard` | — | Thống kê admin; recent activity, active season |
| GET | `/api/admin/redis-overview` | — | Thống kê kiểu dữ liệu/key theo namespace `ba:v2:` bằng SCAN hạn chế; **mask** key session, secret |
| GET | `/api/admin/activity` | `cursor?`, `limit?` | Đọc `XREVRANGE` hoặc `XRANGE`, pagination theo Stream ID |
| GET | `/api/admin/players` | filters | Cùng danh sách public, thêm action/status quản trị |
| POST | `/api/admin/players` | `{playerId,displayName,country,level}` | Tạo player, Set, Hash, tham gia active season với 0 điểm |
| PATCH | `/api/admin/players/:id` | `{displayName?,country?,level?}` | Chỉ sửa hồ sơ, **không sửa score/wins/losses** |
| PATCH | `/api/admin/players/:id/status` | `{status: 'active' hoặc 'inactive'}` | Soft-delete/reactivate; không tự phục hồi heartbeat cũ |
| POST | `/api/admin/players/:id/simulate-heartbeat` | — | Cập nhật timestamp online nếu active; nêu rõ mô phỏng |
| GET | `/api/admin/matches` | filters | Lịch sử đầy đủ, dùng API public semantics hoặc dữ liệu admin bổ sung |
| POST | `/api/admin/matches` | `{matchId,seasonId,mode,player1Id,player2Id,winnerId}` | Ghi trận atomically, trả kết quả before/after; chống trùng |
| GET | `/api/admin/game` | — | Game info và mode statuses |
| PATCH | `/api/admin/game` | `{name?,description?,status?}` | Sửa metadata, `status='maintenance'` khóa ghi trận mới |
| PATCH | `/api/admin/game/modes/:mode` | `{enabled:boolean}` | Bật/tắt Ranked/Friendly |
| GET | `/api/admin/seasons` | — | Season list + participant count + điểm mùa |
| POST | `/api/admin/seasons` | `{seasonId,name}` | Tạo mùa `draft`, chụp defaultRankedWinPoints |
| POST | `/api/admin/seasons/:id/activate` | — | Kích hoạt atomically, đóng active cũ, init members score 0 |
| POST | `/api/admin/seasons/:id/close` | — | Đóng mùa active, xóa pointer nếu là mùa đang active |
| GET | `/api/admin/settings` | — | `defaultRankedWinPoints`, `activeSeasonRankedWinPoints`, `onlineWindowSeconds`, `recentHistoryLimit` |
| PATCH | `/api/admin/settings` | Các field cho phép | Validate và update; không ảnh hưởng trận đã hoàn thành |

**Các dữ liệu tuyệt đối không được phép cập nhật từ UI phổ thông:** `matchId` của trận đã ghi, kết quả trận cũ, season đã closed, Hash counters wins/losses, leaderboard score thủ công, Redis server config/password. Không có admin endpoint nhận câu lệnh Redis bất kỳ.

## 6.5. Example requests/responses

### Tạo player

```http
POST /api/admin/players
Content-Type: application/json

{"playerId":"player25","displayName":"Nguyen Van Minh","country":"VN","level":10}
```

Kết quả: 201; `ba:v2:players` có `player25`, Hash `ba:v2:player:player25` có fields chuẩn; nếu có season active sẽ có member `player25` score 0 trong leaderboard và participant set. Gửi lại ID khác payload => 409; ID đã có inactive cũng không tái sử dụng.

### Ghi trận Ranked

```http
POST /api/admin/matches
Content-Type: application/json

{
  "matchId": "b7d1f3a2-6a5b-4b1c-b2c2-13c05c7a6247",
  "seasonId": "s2026_02",
  "mode": "ranked_1v1",
  "player1Id": "player01",
  "player2Id": "player05",
  "winnerId": "player01"
}
```

Response mẫu (chỉ mô tả cấu trúc, số thực tế do Redis tính):

```json
{
  "success": true,
  "data": {
    "match": {
      "id": "b7d1f3a2-6a5b-4b1c-b2c2-13c05c7a6247",
      "seasonId": "s2026_02",
      "mode": "ranked_1v1",
      "winnerId": "player01",
      "loserId": "player05",
      "pointsAwarded": 300
    },
    "alreadyProcessed": false,
    "winnerBefore": { "score": 0, "rank": 10 },
    "winnerAfter": { "score": 300, "rank": 4 }
  }
}
```

**Không hardcode rank trong response**; ví dụ trên minh họa shape, số rank tùy data seed. Khi retry cùng matchId + payload, `alreadyProcessed=true`, mọi count/score không đổi; tùy code có thể trả before/after gốc được lưu hoặc chỉ `match` + current score, nhưng phải thống nhất contract và test. **Ưu tiên lưu `winnerScoreBefore`/`winnerScoreAfter` cùng match Hash** nếu cần trả chính xác before/after của lần xử lý gốc khi retry; khi đó cập nhật Data Dictionary và tests đồng bộ.

---

# 7. QUY TRÌNH GHI DỮ LIỆU VÀ XỬ LÝ NGUYÊN TỬ

## 7.1. Tạo/sửa/vô hiệu hóa player

1. `zod` validate input, session Admin, kiểm tra ID đúng định dạng.
2. Player create: kiểm tra `SISMEMBER players` / `EXISTS playerHash` trước; thực hiện một script/transaction bảo đảm cùng lúc: `SADD players`, `HSET player`, nếu có active season thì `SADD participants`, `ZADD NX leaderboard 0`, init stats Hash nếu cần, `XADD` event. Không tạo orphan khi 2 request đồng thời dùng cùng ID.
3. Sửa hồ sơ: chỉ update field được whitelist; Redis Search tự duy trì chỉ mục khi Hash thay đổi nếu môi trường Search chính xác.
4. Soft delete: `HSET status inactive`, xóa lastSeen khỏi `online:last_seen`, `XADD` event; giữ score, matches, playerId membership. Reactivate: đổi lại active nhưng **không tự bật online**.
5. Không cho xóa cứng dữ liệu lịch sử.

## 7.2. Ghi một trận — mặc định Lua

**Một lời gọi `POST /api/admin/matches` phải tuân theo trình tự:**

```text
1. Validate request + admin session.
2. Resolve current season, game config, player statuses (pre-check để báo lỗi dễ hiểu).
3. Build canonical request digest từ seasonId/mode/player1Id/player2Id/winnerId.
4. Lấy Redis key names từ validated IDs.
5. Gọi Lua script trên Redis instance standalone với KEYS và ARGV rõ ràng.
6. Lua RE-CHECK trong cùng atomic execution:
   - matchId chưa dùng, hoặc trùng cùng digest => return already processed
   - activeSeason pointer == seasonId; season status=active
   - game active; mode enabled
   - 2 player khác nhau, thuộc participants, Hash status active
   - current score đúng kiểu, settings points hợp lệ, key types đúng trước khi ghi
7. Lua ghi atomically:
   - HSET match details (+ score before/after nếu contract chọn)
   - SADD match:ids
   - HINCRBY thắng/thua ở player Hash và season stats Hash
   - nếu Ranked => ZINCRBY season leaderboard winner points
   - nếu Friendly => KHÔNG gọi ZINCRBY
   - LPUSH matches:recent matchId rồi LTRIM giới hạn
   - ZADD season matches index, player1 matches, player2 matches
   - XADD ba:v2:events với match.recorded
8. Commit xong, API đọc/chuẩn hóa result rồi PUBLISH channel leaderboard.changed
   cho Ranked; SSE clients nhận và refetch.
9. Response có match, points, rank score mới, idempotency status.
```

**Lưu ý Redis Lua:** một script được thực thi nguyên tử đối với lệnh khác, **nhưng không có rollback dữ liệu tự động nếu script đã ghi rồi sau đó phát sinh runtime error**. Do đó mọi validation/key-type preflight phải nằm **trước thao tác ghi**, lệnh ghi phải được kiểm thử kỹ, tránh lỗi phát sinh giữa chừng. Không chỉ dựa vào `MULTI/EXEC` mà quên idempotency check. Chỉ cho phép script nhận key name đã được backend tạo hợp lệ.

### `KEYS` đề xuất cho Lua ghi trận

1. `ba:v2:season:active` — active pointer (String)
2. `ba:v2:season:<seasonId>` — season Hash
3. `ba:v2:game:config` — config Hash
4. `ba:v2:players` — players Set
5. `ba:v2:player:<player1Id>` — player1 Hash
6. `ba:v2:player:<player2Id>` — player2 Hash
7. `ba:v2:season:<seasonId>:participants` — participants Set
8. `ba:v2:season:<seasonId>:stats:<player1Id>` — per-season player1 Hash
9. `ba:v2:season:<seasonId>:stats:<player2Id>` — per-season player2 Hash
10. `ba:v2:season:<seasonId>:leaderboard` — season ZSet
11. `ba:v2:match:ids` — Match IDs Set
12. `ba:v2:match:<matchId>` — match Hash
13. `ba:v2:matches:recent` — recent List
14. `ba:v2:season:<seasonId>:matches` — per-season match index ZSet
15. `ba:v2:player:<player1Id>:matches` — player1 match index ZSet
16. `ba:v2:player:<player2Id>:matches` — player2 match index ZSet
17. `ba:v2:events` — Stream

**`ARGV`** gồm `matchId`, `requestDigest`, `seasonId`, `mode`, `player1Id`, `player2Id`, `winnerId`, `loserId`, `recordedAtISO`, `recordedAtMs`, `adminId`, `recentHistoryLimit` và biến cần thiết. **Điểm thưởng phải đọc từ Redis config/season bên trong script**, không tin trường points từ request frontend. Lua chỉ trả mã trạng thái/score cần thiết, API ánh xạ HTTP.

### Race conditions phải kiểm thử

- Hai request cùng `matchId` và payload → một ghi; một idempotent read, **không gấp đôi score**.
- Hai request cùng `matchId` nhưng winner khác → 409.
- Admin đóng/chuyển season cùng lúc có match → hoặc match commit trong season còn active hoặc bị từ chối, **không tạo match ở closed season**.
- Admin inactive player cùng lúc có match → một thứ tự xử lý hợp lệ, không có match cho player inactive sau khi status đã chuyển.
- Mode bị tắt trong lúc ghi match → script kiểm tra status thực tế, không tin pre-check.

## 7.3. Chuyển mùa atomic

- `POST seasons`: tạo Draft metadata, thêm `ba:v2:seasons`, log event. ID trùng trả 409.
- `POST seasons/:id/activate`: preflight valid Draft; script nguyên tử đọc pointer active, close old season nếu có, init `participants` + scoreboard `ZADD NX 0` cho tất cả player active vào mùa mới, chuyển `draft -> active`, cập nhật pointer, Stream event. **Không reset leaderboard cũ**. Quy mô demo 24–50 người; nếu cần mở rộng production quy mô lớn, tách công đoạn chuẩn bị và chuyển trạng thái, nhưng không mở rộng phạm vi vào đồ án.
- `POST seasons/:id/close`: chỉ active hiện hành; script đóng season, xóa pointer nếu match, log event; tạo khoảng không active là hợp lệ, khi đó form ghi trận bị khóa.
- Thay điểm thắng mùa active: script/check atomic với season metadata; trận hoàn tất trước đó giữ `pointsAwarded` cũ. Nếu settings đổi đồng thời với ghi trận, **thứ tự Redis thực thi xác định** điểm của trận.

## 7.4. Public realtime — Pub/Sub và SSE

- Redis `PUBLISH ba:v2:leaderboard:changed <json>` **sau commit Ranked thành công**; payload tối thiểu `{seasonId,matchId,type:'leaderboard.changed'}`. Có thể phát event cho thay đổi participant/season (kiểu riêng) để UI refresh.
- Backend có **một subscriber Redis connection riêng** (không dùng cùng connection thường cho subscriber mode), lắng nghe channel; broadcast tới SSE clients của API.
- SSE giữ kết nối, gửi heartbeat comment theo chu kỳ, có reconnect/backoff. Khi SSE mở lại hoặc browser focus lại, gọi GET leaderboard/dashboard để đọc **trạng thái authoritative từ Redis**.
- Pub/Sub là tín hiệu **at-most-once**, không dùng làm nguồn lịch sử; Redis Stream events mới có lưu retention, không coi chúng là cùng chức năng.
- Không phát tín hiệu “đã ghi” nếu Lua lỗi. Nếu PUBLISH thất bại sau commit, UI vẫn phải nhìn thấy dữ liệu đúng khi refetch/reconnect; log lỗi publish, không tự ghi lại trận.

## 7.5. Online mô phỏng

- Admin `POST .../simulate-heartbeat` làm `ZADD ba:v2:online:last_seen <nowMs> <playerId>` nếu player active.
- Public `GET online` đọc member có score ≥ `nowMs - windowMs`, lọc lại trạng thái active; score timestamp dịch sang lastSeen.
- Không dùng `EXPIRE` cho cả key Sorted Set để làm từng player hết hạn (sẽ xóa toàn bộ online state).
- Có thể `ZREMRANGEBYSCORE` phần tử cũ hơn ngưỡng retention nhưng API vẫn dựa timestamp kể cả chưa cleanup.

## 7.6. Activity Stream

- Tạo sự kiện cho `player.created`, `player.updated`, `player.deactivated`, `player.reactivated`, `player.heartbeat.simulated`, `match.recorded`, `season.created`, `season.activated`, `season.closed`, `game.updated`, `settings.updated`.
- Dùng `XADD` với fields có cấu trúc, có cơ chế `MAXLEN ~ 5000` để tránh tăng bộ nhớ vô hạn. Stream là nhật ký **phục vụ demo/quan sát**, không phải lưu trữ bất biến vĩnh viễn.
- Admin đọc `XREVRANGE ... COUNT limit` để phân trang, hiển thị loại sự kiện, actor và thời gian. **Không ghi session token, password, Redis password, cookie hoặc payload nhạy cảm**.

---

# 8. NON-FUNCTIONAL REQUIREMENTS (NFR)

| ID | Yêu cầu | Tiêu chí kiểm tra |
|---|---|---|
| NFR-01 | Redis là DB nghiệp vụ duy nhất | Không cần một DB thứ hai để CRUD player/match/season |
| NFR-02 | Tách môi trường V1/V2 | Docker names, host ports, volumes, key prefix mới; V1 không đổi |
| NFR-03 | Bảo mật role | Test request write không cookie trả 401; không lộ Redis URL/password ở bundle |
| NFR-04 | Bảo mật phiên | Cookie HttpOnly/SameSite, TTL thật, logout DEL, bcrypt/argon2, rate-limit |
| NFR-05 | Input validation | IDs, enum, số nguyên, độ dài, null/empty, timestamp; không chèn key injection |
| NFR-06 | Cơ sở dữ liệu nhất quán | Lua/idempotency; unit + integration tests concurrent |
| NFR-07 | UI usable | Desktop/mobile, loading/empty/error, form feedback, không lỗi console cơ bản |
| NFR-08 | Khởi chạy lặp lại | `docker compose up --build -d` + seed idempotent + smoke test rõ ràng |
| NFR-09 | Persistence & backup | AOF và snapshot RDB (nếu cấu hình), restore instance khác đọc đúng dữ liệu |
| NFR-10 | Quan sát | Structured logs có requestId, lệnh theo dõi được trên Redis Insight, không log secret |
| NFR-11 | Search thật | `FT.CREATE` và `FT.SEARCH` hoạt động; trường/index có test, no fake fallback |
| NFR-12 | Graceful failure | Redis unavailable => API 503/500 rõ ràng, UI thông báo, không fake success |
| NFR-13 | SSE phục hồi | Tắt và nối lại, browser refetch data; không mất tính đúng khi Pub/Sub drop |
| NFR-14 | Hiệu năng trình diễn | Dataset demo 24–50 người không treo trang; **không tuyên bố benchmark** nếu không đo |
| NFR-15 | Documentation | README, `.env.example`, seed, scripts, tests, demo steps, Redis Insight/ARDM guide |

## 8.1. Bảo mật môi trường

- Redis port host chỉ bind `127.0.0.1` trong local; production không expose database công khai. Redis password/ACL cần thiết khi triển khai ngoài máy cá nhân. Redis Insight chỉ local hoặc sau network auth.
- Dùng Vite proxy để API và frontend cùng origin ở local; production dùng reverse proxy; hạn chế CORS, kiểm soát CSRF cho cookie-auth write.
- Không lưu plaintext admin password trong `.env.example`, README hoặc Git. Nếu `.env` thật cần nội dung bí mật thì không commit.
- Không xem `Redis Insight` như cơ chế phân quyền của website; authorization nằm trong backend.

## 8.2. Trạng thái hệ thống và lỗi

- `GET /api/health/live`: process chạy; `GET /api/health/ready`: kết nối Redis, kiểm tra schema/index thiết yếu; readiness false nếu Redis/Search unavailable.
- Web UI khi Redis timeout/không kết nối phải hiện trạng thái lỗi có nút thử lại; không lặng lẽ hiển thị sample giả như dữ liệu thật.
- Có logging requestId và reason codes cho conflict/validation; không lộ stack trace ra public response.

---

# 9. SEED DATABASE V2, TEST DATA VÀ MIGRATION

## 9.1. Dataset tối thiểu cho demo

- **24 players** ID hợp lệ (`player01`..`player24`), tên đủ đa dạng, quốc gia gồm VN, JP, US, KR..., level từ thấp tới cao; có ít nhất 1 inactive và 1 level ≥ 10 tại VN.
- **2 seasons**: một closed (`s2026_01`) và một active (`s2026_02`), điểm từng mùa riêng.
- **≥30 matches** phân bổ qua 2 season, cả Ranked và Friendly; ít nhất 1 người điểm 0, ít nhất 1 cặp đồng điểm, ít nhất 1 player thay đổi hạng sau Ranked. Không đưa match vào closed season bằng API thông thường sau khi đã đóng; seed thực hiện thứ tự tạo active mùa 1 → ghi trận → đóng → active mùa 2 → ghi trận.
- **Trạng thái online mô phỏng:** vài player có timestamp mới trong cửa sổ, vài player offline; seed demo có thể cập nhật `lastSeen` bằng script test để ảnh minh chứng ổn định.
- Activity Stream có sự kiện từ việc seed/record nghiệp vụ. Tránh đưa secret vào seed.

## 9.2. Seed phải idempotent

- `scripts/seed.ts` kiểm tra `ba:v2:seed:version` và dữ liệu hiện có; lần chạy thứ hai **không tăng điểm, không thêm trận trùng, không ghi danh sách lặp**.
- Seed chạy **chỉ trên instance V2 local/test**, có guard env, không tự `FLUSHDB`.
- Tách `seed:dev`, `seed:test` nếu cần; test DB/volume riêng, không phá instance demo.
- Nếu dữ liệu đã khác marker, từ chối thay vì tự đè; log rõ hướng xử lý/migration.
- Không dùng dữ liệu từ Redis V1 để giả vờ V2 đã triển khai; V1 chỉ là tài liệu tham khảo.

## 9.3. Migration/version

Dùng `scripts/init-redis.ts` để kiểm tra/khởi tạo config mặc định, `FT.CREATE` index (nếu chưa tồn tại), và các default key; không ghi đè key đang tồn tại. Có `scripts/verify-redis.ts` chạy `PING`, `INFO server`, `FT._LIST`, `TYPE` của key mẫu, kiểm tra số players/seasons/matches. Khi thay đổi schema, thêm migration rõ ràng thay vì xóa hết dữ liệu.

---
# 10. KIỂM THỬ — ACCEPTANCE TEST MATRIX

**Không coi screenshot/UI click là đủ**: mỗi mục nghiệp vụ cần test API + Redis state, tối thiểu có test tích hợp cho các tình huống liên quan nhiều key. Test instance/volume riêng; test có cleanup rõ ràng **chỉ trên test instance**.

| ID | Case | Bước kiểm tra | Kết quả mong đợi |
|---|---|---|---|
| T01 | Health | Start Compose, call readiness | Redis connected, Search index available |
| T02 | Admin login đúng | Login valid secret | 200, cookie HttpOnly, Redis String TTL > 0 |
| T03 | Admin login sai | Sai password nhiều lần | Không tạo session; đến ngưỡng có 429 |
| T04 | Auth guard | POST player không cookie | 401, Redis không thay đổi |
| T05 | Logout | Login → logout → API Admin | Session key mất, lần tiếp theo 401 |
| T06 | Auth expired | TTL session hết | Admin API 401; UI chuyển login |
| T07 | Create player | POST valid player | Hash, Set, active season membership, score 0 |
| T08 | Trùng ID | POST cùng playerId | 409, không tạo bản trùng |
| T09 | Update player | PATCH name/level | Hash và Search index phản ánh dữ liệu mới |
| T10 | Invalid update | Gửi score/wins qua profile PATCH | 400/422, không chỉnh leaderboard/counters |
| T11 | Soft-delete | Chuyển player inactive | Giữ Hash/history/rank, chặn match mới, online false |
| T12 | Reactivate | Inactive → active | Được tham gia trận mới, lịch sử cũ còn |
| T13 | Create draft season | POST season | `draft`, không tự active |
| T14 | Activate season | Active season cũ → season mới | Season cũ `closed`, pointer mới, zero-score board |
| T15 | Close season | POST close active | Pointer xóa, không được ghi trận cho season closed |
| T16 | Closed board | GET leaderboard closed | Dữ liệu y nguyên khi season sau hoạt động |
| T17 | Ranked match | Ghi 1v1 | Winner +points, loser +loss, recent/hash/index/event đủ |
| T18 | Friendly match | Ghi 1v1 | Stats/history thay đổi, **score giữ nguyên** |
| T19 | Retry match identical | POST cùng matchId + payload | alreadyProcessed true, điểm và counters không đổi |
| T20 | Retry mismatch | Cùng matchId, winner khác | 409, điểm không đổi |
| T21 | Invalid players | Player không tồn tại/inactive/trùng nhau | 404/409/422, không có match mới |
| T22 | Mode disabled | Tắt Ranked rồi POST Ranked | 409 MODE_DISABLED |
| T23 | No active season | Đóng season rồi POST match | 409 NO_ACTIVE_SEASON |
| T24 | Season race | Match đồng thời với activate/close | Không có match sau khi season closed; không ghi nửa chừng |
| T25 | Same match concurrency | 2 POST đồng thời 1 matchId | Chỉ 1 match, winner +points 1 lần |
| T26 | Rank | Thay đổi score qua match | ZREVRANK + 1 đúng, Top 5/10 đúng |
| T27 | Equal score | Hai player cùng score | Thứ tự member ổn định, rule công bố rõ |
| T28 | Player Search | Search theo name, VN/level/status | Kết quả từ FT.SEARCH, không phải JS fake |
| T29 | Online window | Ping mô phỏng rồi đổi clock giả/làm hết hạn | Online → offline đúng, không cần xóa cả ZSet |
| T30 | Stream event | Thêm player/ghi match | `XREVRANGE` có event fields, UI Admin hiển thị |
| T31 | Pub/Sub/SSE | Mở 2 browser leaderboard, ghi Ranked | Browser 2 nhận event và refetch score thật |
| T32 | SSE reconnect | Cắt SSE rồi reconnect | Refetch dữ liệu mới nhất, không dựa lost event |
| T33 | Dashboard | Kiểm tra total/Top3/recent | Đúng kết quả key Redis tương ứng |
| T34 | SCAN overview | Mở Admin Redis Data Overview | Có số liệu thật, không lộ session/password/token |
| T35 | Restart persistence | Ghi data → restart Redis container | Dữ liệu cần thiết còn theo persistence config |
| T36 | Restore | BGSAVE → copy dump → start restore instance | Player, 2 mùa, match, leaderboard, Stream kiểm tra đúng |
| T37 | Seed idempotency | Chạy seed 2 lần | `SCARD` match/players, scores, history không tăng thêm |
| T38 | Redis unavailable | Stop Redis, load web | UI báo lỗi, API không trả dữ liệu giả và không báo ghi thành công |
| T39 | Số trang | Mở 5 public + 6 Admin routes | Không route nào là placeholder tĩnh, CRUD hoạt động |
| T40 | ARDM comparison | Cùng Redis V2 đọc Top5/Hash bằng 2 GUI | Trả dữ liệu đồng nhất; ghi rõ những tính năng chưa khảo sát |

**Bắt buộc có integration tests:** T07–T09, T11, T14–T22, T25–T28, T30, T35–T37. Các case UI có thể dùng manual checklist nếu chưa có Playwright, nhưng phải ghi rõ phần nào **manual**.

### 10.1. Assertion mẫu kiểm chứng bằng redis-cli / Workbench

```redis
PING
INFO server
FT._LIST
TYPE ba:v2:players
SCARD ba:v2:players
SMEMBERS ba:v2:seasons
GET ba:v2:season:active
HGETALL ba:v2:player:player01
HGETALL ba:v2:season:s2026_02
ZCARD ba:v2:season:s2026_02:leaderboard
ZRANGE ba:v2:season:s2026_02:leaderboard 0 9 REV WITHSCORES
ZSCORE ba:v2:season:s2026_02:leaderboard player01
ZREVRANK ba:v2:season:s2026_02:leaderboard player01
LLEN ba:v2:matches:recent
LRANGE ba:v2:matches:recent 0 4
SCARD ba:v2:match:ids
ZCOUNT ba:v2:online:last_seen 0 +inf
XREVRANGE ba:v2:events + - COUNT 5
FT.SEARCH idx:ba:v2:players '@country:{VN} @level:[10 +inf] @status:{active}'
```

**Chú ý:** `ZCOUNT ... 0 +inf` chỉ đếm các ping đã lưu, không phải số **đang online**. Để tính online thực sự theo mô hình mô phỏng phải thay cận dưới bằng epoch milliseconds hiện tại trừ cửa sổ. `DBSIZE` đếm key Redis trong DB, **không** phải số player. Các kết quả sample không phải số lượng cam kết khi dữ liệu thay đổi.

---

# 11. REDIS INSIGHT — MA TRẬN MINH CHỨNG CHO BÁO CÁO

Báo cáo giữa kỳ có 13 mục Chương 3; giữ các mục đó, nhưng thêm **ảnh dữ liệu V2 thật** khi có thay đổi, không gắn nhầm ảnh V1 thành V2.

| ID | Chức năng Redis Insight | Thao tác demo V2 | Bằng chứng cần lưu |
|---|---|---|---|
| RI-01 | Databases | Kết nối `redis-v2:6379` từ Insight trên Docker, db0 | Tên connection, host, ping (che secret) |
| RI-02 | Browse | Duyệt `ba:v2:*`, lọc key/type | Key player, season, match và loại dữ liệu |
| RI-03 | Hash | Xem/sửa tên/level player từ UI, đối chiếu | `HGETALL` và form player trước/sau |
| RI-04 | Set/List/ZSet | Xem participants, recent matches, leaderboard | `SCARD/LLEN/ZCARD`, member/score |
| RI-05 | TTL | Login Admin, xem TTL key thử nghiệm | TTL đếm xuống, không lộ session token |
| RI-06 | Workbench | Chạy các lệnh kiểm tra player/season/rank | Câu lệnh và phản hồi |
| RI-07 | CLI | Chạy `PING`, `TYPE`, `ZSCORE`, `TTL` | Kết quả phù hợp Workbench |
| RI-08 | Search | `FT.SEARCH` index player đa điều kiện | Schema, query, số bản ghi match |
| RI-09 | Database Analysis | Quét cấu trúc các key V2 | Số key, cơ cấu type, phạm vi/thời điểm quét |
| RI-10 | Profiler | Bật Profiler, thao tác API từ web | Ghi nhận lệnh backend; tắt sau demo |
| RI-11 | Pub/Sub | Subscribe channel, ghi Ranked từ web | Message xuất hiện; browser refetch |
| RI-12 | Slow Log | Kiểm tra ngưỡng và lệnh ghi nhận | Có timestamp/command/duration, giải thích đúng ý nghĩa |
| RI-13 | Đánh giá công cụ | Tổng hợp công cụ hỗ trợ gì và giới hạn | Nhận xét gắn với bằng chứng, không quảng cáo quá mức |
| RI-14 | Redis Streams (bổ sung) | Đọc `XREVRANGE ba:v2:events` | Activity Logs và event payload nhất quán |
| RI-15 | Backup/restore (Chương riêng) | RDB → restore instance riêng | Ảnh lệnh backup, readback sau restore |

**Profiler/Slow Log:** chỉ dùng trong khoảng demo, công cụ theo dõi lệnh có thể gây overhead. Nếu thử cấu hình `slowlog-log-slower-than = 0` để tạo ví dụ, **khôi phục lại cấu hình cũ** sau kiểm tra, không mô tả các lệnh ghi nhận như thể là lệnh chậm ở chế độ bình thường. Chụp cả lệnh và trạng thái trước/sau khi cần.

### 11.1. So sánh Redis Insight với Another Redis Desktop Manager (ARDM)

- Kết nối **cùng Redis V2**, ARDM desktop đến `127.0.0.1:6380`, Redis Insight Docker đến `redis-v2:6379`.
- Thử cùng các tiêu chí: kết nối, Browse Hash/Sorted Set, kiểm tra trường `wins`, lấy Top 5 của active season, sửa một field **không ảnh hưởng nghiệp vụ điểm** và đối chiếu, khả năng hiển thị kết quả lệnh.
- Với tính năng Search, memory analysis, profiler, import/export: đánh dấu `Đã kiểm tra`, `Có trong tài liệu`, `Chưa kiểm tra` **theo thực tế**, không tự khẳng định công cụ khác thiếu tính năng.
- So sánh hai GUI tool, **không viết ARDM là NoSQL thứ hai**. Nếu có yêu cầu mới buộc so sánh **hai DBMS NoSQL**, đó là phạm vi khác phải xin xác nhận giảng viên.

---

# 12. BACKUP, RESTORE VÀ GÓI NỘP

## 12.1. Persistence

- Redis V2 dùng volume riêng. Cấu hình **AOF** để giảm rủi ro mất dữ liệu giữa các snapshot và hỗ trợ **RDB** để xuất file backup cho đồ án.
- `scripts/backup.sh`: xác nhận đang kết nối instance **V2**, gọi `BGSAVE`, **đợi thành công** bằng `INFO persistence` / timestamp `LASTSAVE` thay vì copy trước khi hoàn tất, copy đúng tệp `dump.rdb` từ volume/container ra `backups/` cùng timestamp và checksum.
- `scripts/restore-verify.sh`: dựng một Redis **độc lập**, data dir/volume trống, chép RDB vào khi instance chưa chạy; đảm bảo bản restore không tự load AOF cũ làm ghi đè snapshot; khởi động Redis và truy vấn các dữ liệu mẫu. Dùng port host thử nghiệm khác (gợi ý `127.0.0.1:6381`) nếu cần mở ARDM/CLI.
- Redis Search metadata/index sau restore phải **được kiểm tra thực tế**; nếu chưa có index thì áp dụng `init-redis` idempotent rồi kiểm tra `FT.SEARCH`. Không mặc định mọi metadata được nạp như nhau trên mọi image/phiên bản.
- Không sửa, reset hoặc nạp restore lên Redis V1; không dùng dữ liệu của Redis V1 làm backup V2.

## 12.2. Kiểm tra bắt buộc sau restore

1. Redis `PING` và `INFO server`, đọc phiên bản thực tế.
2. `SCARD ba:v2:players` = số người đã sao lưu.
3. Hai mùa trong `SMEMBERS ba:v2:seasons`, active pointer đúng.
4. `ZRANGE` hai leaderboard trả dữ liệu phù hợp snapshot.
5. 1 Hash player bất kỳ còn profile, wins/losses đúng.
6. 1 Hash match bất kỳ còn winner, pointsAwarded và season.
7. `LLEN` recent matches + `XREVRANGE` event Stream khớp snapshot.
8. Search index hoạt động hoặc được khởi tạo lại idempotent rồi query đúng.
9. Ghi kết quả vào `docs/restore-verification.md` (không giả định screenshot là test thay thế hoàn toàn).

## 12.3. Các tệp bắt buộc trong bài nộp

- Báo cáo cuối kỳ `.docx` và `.pdf`, nội dung thực nghiệm trung thực, có bảng phân công và tự đánh giá đóng góp thành viên.
- Source code frontend/backend, Dockerfile(s), `compose.yaml`, scripts seed, init, backup, restore-verify, test và README.
- Ít nhất một file **RDB** thực tế có thể phục hồi; checksum/ghi chú phiên bản và hướng dẫn.
- Ảnh minh chứng Redis Insight trên data V2, ARDM trên cùng V2, website đủ 11 trang và những bước xử lý Rank/Friendly/Season.
- `.env.example`; **không nộp** `.env` chứa credential thật, session tokens hoặc tệp bí mật.

---

# 13. CẤU TRÚC REPOSITORY CHUẨN ĐỂ CODEX TẠO

```text
battle-arena-v2/
├── README.md
├── compose.yaml
├── .env.example
├── .gitignore
├── docs/
│   ├── 01_Battle_Arena_V2_De_Tai_Yeu_Cau_Va_Dinh_Huong_Redis.md
│   ├── 02_Battle_Arena_V2_SRS_Technical_Spec_For_Codex.md
│   ├── architecture.md
│   ├── redis-schema.md
│   ├── api-contract.md
│   ├── demo-script.md
│   ├── redisinsight-and-ardm-comparison.md
│   ├── restore-verification.md
│   └── screenshots/                 # Bằng chứng sau khi chạy thật
├── apps/
│   ├── web/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/                  # router, layout, providers
│   │       ├── pages/public/         # Dashboard, Leaderboard, Players, History, Online
│   │       ├── pages/admin/          # Login, Dashboard, Players, Matches, Game, Settings
│   │       ├── components/           # cards, tables, forms, badges, modals
│   │       ├── features/             # domain-specific UI/state
│   │       ├── lib/api.ts            # HTTP client + auth redirect
│   │       └── styles/
│   └── api/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── app.ts                # express setup
│           ├── server.ts             # startup/shutdown
│           ├── config/
│           ├── middleware/           # admin auth, validation, rate limit, errors
│           ├── routes/               # public, auth, admin, health
│           ├── modules/
│           │   ├── auth/
│           │   ├── players/
│           │   ├── seasons/
│           │   ├── matches/
│           │   ├── leaderboard/
│           │   ├── game/
│           │   ├── online/
│           │   ├── activity/
│           │   └── realtime/
│           ├── redis/                # redis client, schema helper, index, repositories
│           ├── scripts/lua/          # match.atomic.lua, player.create.lua, season.activate.lua
│           └── tests/
├── scripts/
│   ├── init-redis.ts
│   ├── seed.ts
│   ├── verify-redis.ts
│   ├── create-admin-hash.ts
│   ├── backup.sh
│   └── restore-verify.sh
├── backups/                      # Chỉ đặt backup thực tế cần nộp, không commit secrets
└── .github/workflows/            # Optional lint/test CI
```

Cấu trúc có thể tinh chỉnh đường dẫn nội bộ để phù hợp toolchain, **nhưng phải giữ rõ các module, tài liệu, script và API contract**. Nếu `scripts/*.ts` chạy cần tsx/ts-node thì khai báo dependency, hướng dẫn chính xác trong README.

---

# 14. KẾ HOẠCH THỰC THI VÀ ĐIỀU KIỆN HOÀN THÀNH

| Giai đoạn | Nhiệm vụ | Điều kiện xong |
|---|---|---|
| 1. Infrastructure | Compose, Redis V2, Redis Insight, API/Web skeleton, env, health | 4 service khởi động được, `PING`, Search check pass, không đụng V1 |
| 2. Redis schema | config, indexes, keys, seed, verification | 24 players, 2 season, ≥30 matches, seed idempotent |
| 3. Backend core | auth, player/season API, Lua match, rank/history endpoints | Tests T02–T27 pass |
| 4. Frontend core | 5 public + 6 Admin, forms, responsive, error states | 11 routes thật, APIs thật, flow end-to-end |
| 5. Advanced | Search filter, Streams Activity Logs, Pub/Sub→SSE, Data Overview | Tests T28–T34 pass |
| 6. Nghiên cứu GUI | Redis Insight 13 mục, ARDM comparison | Screenshots/notes có lệnh và dữ liệu đối chiếu |
| 7. Delivery | backup/restore, docs, tests, Word/PDF cuối kỳ, phân công | T35–T40 pass + đủ tệp nộp |

**Với hạn 24/11/2026**, cần ưu tiên core chạy end-to-end và bằng chứng thật trước, không thêm tính năng ngoài phạm vi. Phân chia công việc nhóm theo module: (A) Redis/Backend, (B) Frontend, (C) QA/Redis Insight/Documentation, nhưng có thể phân vai linh hoạt; **chưa tự gán tên thành viên vào nhiệm vụ khi nhóm chưa phân công**.

## 14.1. Definition of Done (DoD) cho mỗi tính năng

Một mục chỉ được đánh dấu `DONE` nếu có đủ:

- [ ] Giao diện/route hoạt động và gọi API thật.
- [ ] Backend validate, phân quyền, xử lý lỗi rõ ràng.
- [ ] Redis key và type đúng theo Data Dictionary.
- [ ] Có test cho happy path + ít nhất 1 trường hợp lỗi; nghiệp vụ nhiều key phải có integration test.
- [ ] Không lộ secret và không phá dữ liệu V1.
- [ ] Có chỉ dẫn/demo kiểm chứng bằng Redis Insight.
- [ ] Có hướng dẫn chạy và script dữ liệu tái lập.

## 14.2. Báo cáo tiến độ cho nhóm và Codex

Sau mỗi giai đoạn cập nhật bảng:

| Module | Trạng thái | Test đã chạy | Kết quả | Rủi ro |
|---|---|---|---|---|
| Redis infrastructure | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Auth | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Player/Season | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Ranked/Friendly Match | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Public UI | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Admin UI | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Search/PubSub/Stream | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Backup/Restore | TODO / IN_PROGRESS / DONE | ... | ... | ... |
| Report evidence | TODO / IN_PROGRESS / DONE | ... | ... | ... |

Nếu chỉ viết code mà chưa chạy, ghi **IMPLEMENTED / NOT VERIFIED** trong notes, không đánh dấu DONE.

---

# 15. MINH HỌA DEMO END-TO-END BẮT BUỘC

**Kịch bản cốt lõi để quay/chụp khi báo cáo:**

1. Start Compose, mở website Public; thấy Dashboard/Leaderboard/Players/History/Online lấy từ Redis V2.
2. Mở Redis Insight ở `http://localhost:5541`, kiểm tra key `ba:v2:*`, `SCARD players`, bảng điểm mùa active.
3. Admin login; chứng minh session có TTL trên Redis bằng cách quan sát an toàn (mask token).
4. Admin thêm 1 player (Hash + Set + season participant + score 0); web Public thấy player ngay.
5. Admin tạo 1 trận **Ranked**: player A thắng player B, pointsAwarded từ season settings, thắng/thua và rank thay đổi.
6. Browser thứ hai đang mở Leaderboard tự reload bằng SSE, không F5; Redis Insight Profiler ghi được các lệnh backend (nếu bật đúng lúc).
7. Gửi lại đúng `matchId`; response idempotent và score **không** tăng lần 2.
8. Ghi trận **Friendly**: lịch sử và stats có thêm, điểm Sorted Set **không đổi**.
9. Tìm người VN level ≥ 10 bằng FT.SEARCH trong Redis Insight và trên UI Players.
10. Đọc Recent Matches trong List, xem Hash match; đọc Activity Stream và màn Admin Dashboard; kiểm tra Database Analysis/Slow Log/PubSub khi thích hợp.
11. So sánh Redis Insight với ARDM bằng **cùng Top 5 query**, không dùng 2 dataset khác nhau.
12. Đóng mùa cũ, mở mùa mới, leaderboard mới bắt đầu điểm 0 và season cũ đọc vẫn đúng.
13. BGSAVE, copy `dump.rdb`, restore instance mới, chạy verify script, chụp kết quả đọc lại.

Chỉ báo cáo các bước thực sự hoàn thành; nếu demo có sự cố, ghi rõ hiện trạng và không tự dựng ảnh giả làm kết quả thực nghiệm.

---

# 15A. FUNCTIONAL REQUIREMENTS TRACEABILITY — BẢNG CHỐNG BỎ SÓT

Bảng `FR` là bản rút gọn để Codex truy vết từ màn hình → API → Redis → test, **không thay thế phần đặc tả chi tiết**.

| FR | Chức năng bắt buộc | UI / API | Redis | Test |
|---|---|---|---|---|
| FR-01 | Tổng quan công khai từ dữ liệu thật | `/`, `GET /api/public/dashboard` | SCARD players/matches, leaderboard, recent List | T33 |
| FR-02 | Bảng điểm Top N, rank 1-based, lọc theo mùa | `/leaderboard`, `GET /api/public/leaderboard` | Season Sorted Set + player Hash | T16, T26, T27 |
| FR-03 | Tìm kiếm player theo tên/quốc gia/level/status | `/players`, `GET /api/public/players` | `FT.SEARCH` index Hash | T09, T28 |
| FR-04 | Hồ sơ chi tiết + thành tích mùa | `/players/:id` | player Hash, season stats, season ZSet | T07, T09, T26 |
| FR-05 | Match History theo season/mode/player | `/history` | Match Hash + List + Sorted Set time index | T17, T18 |
| FR-06 | Online Players mô phỏng có timeout | `/online` | `online:last_seen` ZSet | T29 |
| FR-07 | Admin login, session Redis TTL, logout | `/admin/login`, `/api/auth/*` | String + TTL + rate-limit | T02–T06 |
| FR-08 | Admin Dashboard và Redis Data Overview | `/admin`, `/api/admin/redis-overview` | `SCAN` an toàn, SCARD/ZCARD/LLEN | T33, T34 |
| FR-09 | Admin Activity Logs | `/admin`, `/api/admin/activity` | Stream `ba:v2:events` | T30 |
| FR-10 | Thêm player đồng bộ nhiều key | `/admin/players`, POST players | Hash + Set + ZADD NX + Stream | T07, T08 |
| FR-11 | Sửa hồ sơ và soft-delete | `/admin/players`, PATCH players | Hash + online ZSet + Stream | T09–T12 |
| FR-12 | Mô phỏng heartbeat | `/admin/players`, POST heartbeat | ZADD online timestamp | T29 |
| FR-13 | Ghi nhận Ranked thắng +points | `/admin/matches`, POST matches | Lua, ZINCRBY, Hash, List, ZSet, Stream | T17, T25 |
| FR-14 | Ghi nhận Friendly không đổi score | `/admin/matches`, POST matches | Lua, Hash stats/history, no ZINCRBY | T18 |
| FR-15 | Chặn trùng matchId, chống ghi nửa chừng | POST matches | Lua atomic, Hash requestDigest | T19, T20, T24, T25 |
| FR-16 | Quản lý game và bật/tắt mode | `/admin/game`, PATCH game/modes | Game config Hash + event Stream | T22 |
| FR-17 | Tạo/active/close season, lưu bảng cũ | `/admin/game` tab Seasons | Seasons Set + Hash + pointer String + ZSet | T13–T16, T24 |
| FR-18 | Chỉnh quy tắc điểm & online window | `/admin/settings` | Game config Hash + active season Hash | T17, T29 |
| FR-19 | Realtime leaderboard thay đổi | SSE public route | Pub/Sub + SSE reconnect/refetch | T31, T32 |
| FR-20 | Search/migration/seed reproducible | scripts setup/seed | Redis 8 Search + 24 players + 2 seasons + matches | T01, T28, T37 |
| FR-21 | Backup/restore kết quả thật | scripts backup/restore-verify | RDB/AOF, readback | T35, T36 |
| FR-22 | Redis Insight + ARDM comparison | GUI và docs, không phải route API | Cùng Redis V2 instance | T40 |

**Thứ tự ưu tiên khi có xung đột nguồn:** quyết định nghiệp vụ đã khóa → đặc tả Redis key/API và test ở file này → gợi ý UI. Nếu bản code chọn kỹ thuật khác (ví dụ đổi thư viện React) nhưng vẫn đáp ứng đầy đủ hợp đồng, phải ghi giải thích trong README; không tự đổi key prefix, business rule hoặc endpoint public/admin rồi bỏ cập nhật đặc tả.

---

# 16. NHỮNG QUYẾT ĐỊNH ĐÃ KHÓA — KHÔNG CẦN HỎI LẠI

| Hạng mục | Quyết định |
|---|---|
| Game | **Một** game Battle Arena |
| Mode | `ranked_1v1` và `friendly_1v1` |
| Score | Ranked thắng +300 mặc định, thua +0; Friendly +0 cho cả hai |
| Điểm thay đổi | Theo cấu hình server tại thời điểm trận, không sửa retroactive |
| Seasons | Nhiều mùa, leaderboard riêng; draft/active/closed, tối đa một active |
| Player auth | **Không có** login player trong V2; chỉ Admin login |
| Online | **Mô phỏng lastSeen**, không nhận là online thực tế |
| Deletion | Soft-delete player, giữ match/history/leaderboard cũ |
| Tie ranking | Thứ tự Redis Sorted Set khi sort descending; rank 1-based |
| Match update | Lua atomically, idempotency matchId, không sửa kết quả cũ |
| Key namespace | `ba:v2:` trên Redis instance/volume mới |
| Primary DB | Redis 8.x có Search; không DB nghiệp vụ phụ |
| Admin logs | Redis Streams (giới hạn độ dài) |
| Realtime | Redis Pub/Sub → backend SSE → refetch từ Redis |
| Redis insight | Công cụ GUI chính, không làm lại bên trong website |
| So sánh | **ARDM** cùng dataset; là GUI khác, không phải NoSQL DBMS khác |
| Số trang | **11 chính**: 5 Public + 6 Admin, chi tiết/tabs không tăng số này |
| Stack | React + Vite + TypeScript; Express + TypeScript + node-redis; Docker Compose |
| Dữ liệu mẫu | 24 player, 2 season, ≥30 matches, có seed idempotent |
| Backup | RDB thật, restore trên instance độc lập, verify dữ liệu |
| Báo cáo | Kế thừa nghiên cứu Redis Insight giữa kỳ và bổ sung triển khai V2 thực tế |

Nếu yêu cầu của giảng viên thay đổi chính thức, cập nhật cả tài liệu 01 và 02, tăng version và ghi changelog. **Không để coding agent tự thay đổi các quyết định này vì cảm thấy “dễ hơn”.**

---

# 17. TÀI LIỆU THAM KHẢO, TRUY VẾT VÀ CHÚ Ý TÍNH TRUNG THỰC

**Nguồn thuộc nhóm học phần:**

- `20_DoanLeThanhPhi.docx` — báo cáo giữa kỳ: Chương 3 Redis Insight; Chương 4 so sánh Redis Insight/ARDM; Chương 5 thiết kế game mẫu; Chương 6 cập nhật transaction; Chương 7 định hướng web; Chương 8 RDB.
- `Chương 5. Redis(1).pdf` — slide Redis: tổng quan, kiểu dữ liệu, lệnh thao tác và kết nối ứng dụng.
- `TH_HUONG DAN THUC HANH NoSQL_2025(1).pdf` — tham khảo thực hành chung; tệp đã nhận không có nội dung chi tiết của Chương Redis phía sau trang mở đầu.
- Classroom: giữa kỳ so sánh **hai GUI tools**, cuối kỳ nộp Word/PDF + phân công + backup + source.

**Nguồn kỹ thuật chính thức nên kiểm tra khi triển khai:**

- Redis 8 & Search: https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/redisos-8.0-release-notes/
- Redis Search, FT.CREATE: https://redis.io/docs/latest/commands/ft.create/
- Redis Sorted Set: https://redis.io/docs/latest/develop/data-types/sorted-sets/
- Redis use-case leaderboard: https://redis.io/docs/latest/develop/use-cases/leaderboard/
- Redis Lua scripting: https://redis.io/docs/latest/develop/programmability/eval-intro/
- Redis Insight Docker: https://redis.io/docs/latest/operate/redisinsight/install/install-on-docker/
- Redis Open Source Docker: https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/

**Tính trung thực về mức hoàn thành:** Những bảng ở tài liệu này là **yêu cầu cần xây dựng**, không phải tuyên bố hệ thống đã tồn tại. Các số liệu seed, API response mẫu và hình giao diện mô tả là **thiết kế**, chỉ đưa vào phần **kết quả đạt được** của báo cáo sau khi chạy/đối chiếu thật.

---

# PHỤ LỤC A — CHECKLIST BÀN GIAO 1 TRANG

- [ ] Repo có `compose.yaml`, `.env.example`, frontend/backend và README.
- [ ] Redis V2 chạy độc lập, namespace `ba:v2:`, không ảnh hưởng Redis giữa kỳ.
- [ ] Docker Redis có Search, `FT.CREATE` và `FT.SEARCH` hoạt động.
- [ ] Giao diện đủ **11 trang chính**, mọi chức năng chính có API thật.
- [ ] Admin login/session TTL/rate limit/logout hoạt động.
- [ ] Player CRUD mềm; giữ dữ liệu lịch sử khi vô hiệu hóa.
- [ ] Season draft/active/closed, bảng điểm riêng, chỉ một active.
- [ ] Ranked +300 mặc định, Friendly +0 điểm, wins/losses/history cập nhật đúng.
- [ ] Match atomic & idempotent; không cộng điểm hai lần.
- [ ] 5 kiểu Redis cơ bản + Redis Search + Streams + Pub/Sub + TTL + Lua có bằng chứng.
- [ ] Redis Insight: 13 mục đã nghiên cứu và demo V2 thực tế.
- [ ] ARDM: so sánh cùng Redis V2, ghi nhận đúng giới hạn thực nghiệm.
- [ ] Seed có 24 players, 2 seasons, ≥30 matches; chạy lại không nhân đôi.
- [ ] RDB và restore verification trên instance mới.
- [ ] Source, báo cáo Word/PDF, bảng phân công/đánh giá thành viên và hình minh chứng đầy đủ.

**END OF SRS**
