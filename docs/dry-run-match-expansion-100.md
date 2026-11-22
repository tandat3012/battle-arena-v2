# Báo cáo dry-run mở rộng dữ liệu lên 100 trận

**Ngày kiểm tra:** 22/11/2026
**Phạm vi:** Chỉ Redis clone độc lập; chưa ghi vào Redis V2 chính.

## Kết quả

Đã gửi 66 trận trong `data/match-expansion-66.json` qua API nghiệp vụ `POST /api/admin/matches` trên API clone đã đăng nhập. Cả 66 yêu cầu tạo mới trả `201`. Sau đó:

- Gửi lại một `matchId` cùng payload trả `200`, `alreadyProcessed=true`.
- Gửi lại ID đó với winner khác trả `409 MATCH_ID_CONFLICT`.
- Tổng cộng **23 đối chiếu dữ liệu đều đạt, 0 lỗi**.

## Baseline và cách ly

| Hạng mục | Kết quả trước khi chạy |
| --- | --- |
| RDB nguồn | `backups/battle-arena-v2-20261122-150730.rdb` |
| SHA-256 RDB | `c39ff85db68e1d10e393cf0a0f68e1ca5d38e81c3cf0aa5ff772032d390d9169` |
| Redis V2 nguồn | 34 trận; mùa `s2026_01` có 16, mùa `s2026_02` có 18 |
| Mùa active | `s2026_02`; Ranked và Friendly đang bật; Ranked thắng được 300 điểm |
| Participants mùa 2 | 23 người chơi active; không có `player23` |

RDB được sao chép vào `/tmp/ba-v2-match-dryrun.J0gCH7ar/data/dump.rdb`; SHA-256 bản sao khớp file backup trước khi nạp. Sau khi kiểm chứng, Redis clone đã chạy `SAVE` để giữ dataset thử nghiệm trong thư mục tạm đó. File RDB backup gốc không bị ghi đè.

File backup gốc vẫn vượt qua `sha256sum -c`; kết quả restore verification trước đó **153 OK / 0 FAIL** được giữ nguyên, không chạy restore lên Redis chính.

| Thành phần clone | Địa chỉ |
| --- | --- |
| Redis clone `ba-v2-match-dryrun-redis` | `127.0.0.1:6382` |
| API clone dùng để gửi trận `ba-v2-match-dryrun-api-auth` | `127.0.0.1:3003` |
| Docker network riêng | `ba-v2-match-dryrun-net` |

API được cấu hình `REDIS_URL=redis://dryrun-redis:6379`, `SEED_ON_START=false`, Origin `http://localhost:5173`; readiness trả 200 với Redis, Search và Pub/Sub sẵn sàng. Network clone chỉ có các container dry-run. API dùng cấu hình Admin hiện có; không đổi mật khẩu. Không lưu session cookie vào manifest hay báo cáo.

Lần khởi chạy đầu ở cổng 3002 trả `ADMIN_NOT_CONFIGURED` do Docker CLI giữ dấu nháy quanh giá trị trong `.env`. Chưa có trận nào được gửi từ lần đó; container do lượt này tạo đã được dừng nhưng không xóa. API clone thứ hai nạp cùng hash hiện có theo cách chuẩn hóa biến môi trường và là API duy nhất dùng để gửi 66 trận.

## Đối chiếu sau khi ghi vào clone

| Kiểm tra | Kết quả |
| --- | --- |
| Tổng số trận | 100 |
| Ranked / Friendly toàn hệ thống | 74 / 26 |
| Mùa 1 | 16 trận; toàn bộ snapshot key `ba:v2:season:s2026_01*` giống nguồn |
| Mùa 2 | 84 trận: 61 Ranked, 23 Friendly |
| 34 trận cũ | Tất cả Hash field/value bằng Redis nguồn |
| Cặp đấu mùa 2 | 84 cặp duy nhất, không lặp giữa 18 trận cũ và 66 trận mới |
| Participants | Cùng đúng 23 ID như nguồn; `player23` vẫn inactive và không tham gia |
| Số lần xuất hiện mới | Mỗi participant có 4 trận Ranked; 17 người có 2 trận Friendly, 6 người có 1 |
| Phân bổ Ranked thắng mới | 6 người thắng 3 trận; 11 người thắng 2; 6 người thắng 1 |
| Friendly thắng mới | 20 người thắng khác nhau, mỗi người 1 trận |
| Điểm | 46 Ranked thắng cộng tổng 13.800 điểm, đúng +300 mỗi trận; 20 Friendly đều 0 điểm |
| Wins/losses | Tổng người chơi và thống kê từng mùa khớp winner/loser trong manifest |
| Leaderboard | Điểm từng người đúng bằng baseline cộng 300 × số Ranked thắng mới |
| History | Season index và lịch sử từng người có đúng các trận mới; không thiếu hoặc tăng thừa |
| Recent list | Đúng 100 ID, bằng tập 100 trận hiện có |
| Stream | Trước: 72 entry, 34 `match.recorded`; sau: 138 entry, 100 `match.recorded`; có đúng 66 event mới, mỗi match ID đúng một event |
| Redis Search | Trả đủ cùng 23 người chơi active ở nguồn và clone |
| Idempotency | Retry cùng payload không tạo trận/event/điểm lần hai; payload khác cùng ID bị từ chối |
| Cấu hình | Active pointer, metadata mùa 2 và game config không đổi |

Đối chiếu Stream kiểm tra `entityId` của từng trận trong manifest và delta số event `match.recorded`; kết quả không dựa vào tổng số loại event khác trong Stream.

## Bảo toàn dữ liệu và giới hạn

- Redis V2 chính tại cổng 6380 vẫn có **34 trận**, mùa 1 **16**, mùa 2 **18**, active pointer vẫn là `s2026_02`.
- Redis restore đang dùng tại 6381 và Redis test tại 6390 không được ghi.
- Không chạy seed, `FLUSHDB`, `FLUSHALL`, reset volume, restore vào Redis chính, hay thay đổi schema/nghiệp vụ.
- Dataset mới là **dữ liệu mô phỏng cho kiểm thử**, không phải lịch sử trận đấu thật. Nó chưa được đưa vào Redis V2 chính.
- Bản sao nằm dưới `/tmp`; thư mục tạm có thể bị hệ điều hành dọn. Manifest và báo cáo trong repository là nguồn tái tạo ổn định. API clone và Redis clone hiện được giữ chạy để nhóm có thể xem; không có thay đổi Git nào được commit hoặc push.

## Artifact

- Manifest cố định: `data/match-expansion-66.json`
- SHA-256 manifest: `cc634580d43b061d4ab5e3feaa5798c8d0d8c29631dc586976589da171d9f788`
- Hướng dẫn tái tạo clone: `docs/recreate-match-expansion-100.md`
