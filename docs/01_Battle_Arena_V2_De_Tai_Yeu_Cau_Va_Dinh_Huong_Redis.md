# BATTLE ARENA V2 — TÀI LIỆU THỐNG NHẤT ĐỀ TÀI, YÊU CẦU NGHIỆP VỤ VÀ ĐỊNH HƯỚNG REDIS

> **Loại tài liệu:** Project Brief + Business Requirements + Database Design Rationale (dành cho nhóm đồ án, người đọc và người thiết kế CSDL).  
> **Dự án:** Đồ án học phần Dữ liệu NoSQL — *Tìm hiểu công cụ Redis Insight để quản trị và khai thác CSDL Redis cho ứng dụng quản lý bảng xếp hạng trò chơi trực tuyến, đồng thời xây dựng ứng dụng minh họa*.  
> **Sản phẩm:** **Battle Arena V2 — Online Gaming Leaderboard & Management System**.  
> **Bản đặc tả kỹ thuật cho Codex:** `02_Battle_Arena_V2_SRS_Technical_Spec_For_Codex.md`.  
> **Cập nhật:** 17/11/2026. **Hạn nộp được thông báo:** 24/11/2026.  
> **Trạng thái:** Đặc tả đã thống nhất về định hướng; **không có nghĩa ứng dụng V2 đã được triển khai**.

---

## 1. Vì sao cần tài liệu này?

Tài liệu thống nhất những điều nhóm đã thảo luận để ba thành viên cùng hiểu **làm sản phẩm gì, vì sao làm, Redis giữ dữ liệu nào, Redis Insight sẽ chứng minh điều gì**. Đây là bản *mô tả nghiệp vụ và mục tiêu*, không phải chỉ dẫn lập trình từng hàm.

Có **hai sản phẩm cần đi song song**:

1. **Một website thực tế có nghiệp vụ hợp lý, lưu dữ liệu chính bằng Redis**: người dùng xem người chơi/bảng xếp hạng/lịch sử, quản trị viên quản lý người chơi, game, mùa giải và kết quả thi đấu.
2. **Một nghiên cứu và thực nghiệm Redis Insight có chiều sâu**: kết nối, xem/chỉnh sửa dữ liệu, truy vấn, theo dõi, phân tích, sao lưu và phục hồi; so sánh với Another Redis Desktop Manager (ARDM).

**Nguyên tắc quan trọng:** Website không được chỉ là một màn hình tĩnh gắn nhãn Redis. Mọi thay đổi nghiệp vụ phải thực sự ghi vào Redis, hiển thị lại trên website, và có thể đối chiếu qua Redis Insight. Ngược lại, **không lập trình lại Redis Insight trong website**: công cụ đó vẫn là giao diện quản trị độc lập.

### 1.1. Tài liệu nguồn

- `20_DoanLeThanhPhi.docx`: **báo cáo giữa kỳ**, đã nghiên cứu Redis/Redis Insight, thiết lập Docker, 10 người chơi, Sorted Set bảng xếp hạng, Hash hồ sơ, Set, List, truy vấn, transaction, backup/restore, so sánh Redis Insight với ARDM. Chương 3 của tài liệu có 13 mục chức năng Redis Insight; Chương 7 ghi rõ website mới là kiến trúc đề xuất, **chưa phải website đã chạy**.
- `Chương 5. Redis(1).pdf`: slide Redis của cô, gồm tổng quan, cài đặt, kiểu dữ liệu và lệnh Redis, kết nối ứng dụng; có nội dung về String, Hash, List, Set, Sorted Set và các khả năng mở rộng.
- `TH_HUONG DAN THUC HANH NoSQL_2025(1).pdf`: tài liệu thực hành tham khảo của môn học. Bản được cung cấp gồm 88 trang và kết thúc tại trang mở đầu Chương 4 Redis; vì vậy **không coi bản này là nguồn hướng dẫn đầy đủ phần thực hành Redis**.
- Hai ảnh bài tập Google Classroom: **giữa kỳ yêu cầu so sánh tool với một GUI tool khác**; **cuối kỳ yêu cầu** báo cáo Word/PDF có bảng phân công, file backup và source code. Nếu giảng viên ban hành yêu cầu mới, ưu tiên yêu cầu chính thức mới nhất.

### 1.2. Phân biệt nội dung cũ và V2

| Nội dung | Trạng thái |
|---|---|
| Nghiên cứu Redis Insight và ARDM ở giữa kỳ | Đã có báo cáo và ảnh thực nghiệm; giữ lại, kiểm tra và cập nhật nếu cần |
| Redis V1 với 10 người chơi | Đã tồn tại ở mô hình mẫu; dùng làm đối chiếu, **không ghi đè** |
| Battle Arena V2 — 11 trang, 2 khu vực | Phạm vi mới đã thống nhất, **cần xây dựng** |
| Redis V2 tách biệt, có nhiều mùa giải và 2 chế độ đấu | Thiết kế mục tiêu, **cần triển khai và kiểm thử** |
| Redis Search, Pub/Sub realtime, Stream hoạt động từ website | Yêu cầu triển khai/kiểm chứng V2; không được báo cáo là hoàn thành khi chưa chạy thử |

---

## 2. Tên đề tài, mục tiêu và phạm vi

### 2.1. Tên đề tài đăng ký

**Tìm hiểu công cụ Redis Insight để quản trị và khai thác CSDL Redis “Quản lý bảng xếp hạng trò chơi trực tuyến” và xây dựng ứng dụng minh họa.**

Tên website sử dụng trong sản phẩm: **Battle Arena V2**. Đây là **một hệ thống quản lý bảng xếp hạng và mô phỏng kết quả đấu 1v1**, không phải game online có đồ họa/điều khiển nhân vật.

### 2.2. Mục tiêu học thuật

- Hiểu Redis là CSDL NoSQL kiểu key–value, dùng cấu trúc dữ liệu phù hợp từng truy vấn.
- Vận dụng **5 kiểu cơ bản** trong dữ liệu thật: String, Hash, List, Set, Sorted Set.
- Vận dụng các năng lực bổ sung có ích: TTL, Redis Search, Pub/Sub, xử lý nguyên tử bằng Lua/transaction và Redis Streams.
- Có dữ liệu minh họa để sử dụng **Redis Insight**: quản lý kết nối, Browse, chỉnh sửa kiểu dữ liệu, Workbench, CLI, Search, Database Analysis, Profiler, Pub/Sub và Slow Log.
- Có quy trình **backup/restore có kiểm chứng**, không chỉ tạo file rỗng hoặc chụp ảnh nút bấm.
- So sánh **Redis Insight vs ARDM** trên **cùng Redis instance/dataset và cùng kịch bản**. Hai công cụ đều là GUI cho Redis; **ARDM không phải một hệ quản trị NoSQL khác**.

### 2.3. Mục tiêu sản phẩm

- Website có giao diện hiện đại, nhất quán, dùng được trên desktop và mobile ở mức cơ bản.
- Người xem không cần đăng nhập để tra cứu dữ liệu công khai.
- Chỉ Admin đã đăng nhập mới được thay đổi người chơi, kết quả đấu, chế độ, mùa giải, cấu hình.
- Bảng điểm cập nhật chính xác, không cộng điểm hai lần do trùng yêu cầu, không lẫn điểm các mùa.
- Trận Ranked ảnh hưởng thứ hạng; trận Friendly có lịch sử/thắng thua nhưng **không** thay đổi điểm xếp hạng.
- Có thể tái dựng môi trường bằng Docker Compose, seed dữ liệu và kiểm tra Redis Insight.

### 2.4. Không nằm trong phạm vi bản đồ án

Không làm game hành động/multiplayer thật; không tích hợp thanh toán/vật phẩm; không bắt buộc đăng ký và đăng nhập tài khoản người chơi; không xây hệ thống giải đấu nhiều đội phức tạp; không chạy nhiều Redis Cluster hoặc microservices để khoe công nghệ; không biến nhiều kiểu Redis không liên quan (Geo, Vector) thành tính năng miễn cưỡng. Không khẳng định hiệu năng hàng triệu truy vấn/giây từ bộ dữ liệu mẫu.

---

## 3. Đối tượng sử dụng và phân quyền

### 3.1. Khách/người xem công khai

- Xem tổng quan game, bảng xếp hạng, danh sách/hồ sơ người chơi, lịch sử trận, danh sách trạng thái hoạt động mô phỏng.
- Lọc theo mùa, chế độ, tên, điểm, quốc gia, level khi trang có bộ lọc tương ứng.
- **Không** được sửa điểm, ghi kết quả hay quản trị hệ thống.

### 3.2. Admin

- Đăng nhập bằng tài khoản quản trị; phiên đăng nhập lưu trong Redis có TTL và có đăng xuất.
- Xem dashboard quản trị, Redis Data Overview (chỉ đọc thông tin an toàn), nhật ký hành động.
- Tạo/chỉnh sửa/vô hiệu hóa người chơi; xem thành tích và lịch sử.
- Ghi nhận kết quả đấu 1v1 theo quy tắc server, xem trạng thái trước/sau.
- Quản lý một trò chơi Battle Arena, hai chế độ Ranked/Friendly, các mùa giải và thiết lập được cho phép.
- Mô phỏng trạng thái online bằng thao tác kiểm thử, không ngụy tạo là dữ liệu người chơi đăng nhập thật.

**Mô hình tài khoản đã chốt:** Chỉ Admin có chức năng đăng nhập trong V2. Người chơi là **hồ sơ dữ liệu**, không phải account có mật khẩu. Vì vậy, mọi nhãn online ở phiên bản này phải ghi rõ **mô phỏng/hoạt động giả lập**.

---

## 4. Cấu trúc website: 11 trang chức năng chính

Website có **5 trang công khai** và **6 trang Admin (tính cả trang đăng nhập)**. Trang chi tiết người chơi, tab mùa giải, modal, bộ lọc và nhật ký nhúng **không tính thành trang chính mới**.

### 4.1. Khu vực công khai — 5 trang

| Mã | Trang và đường dẫn | Dữ liệu hiển thị | Tương tác chính |
|---|---|---|---|
| P01 | **Dashboard** `/` | Tổng người chơi, tổng trận, số online mô phỏng, Top 3, trận mới | Xem tóm tắt, chuyển sang trang chi tiết |
| P02 | **Leaderboard** `/leaderboard` | Điểm, thứ hạng theo mùa, win/loss, level | Chọn mùa, Top 5/10/tất cả, tìm ID/tên, lọc điểm |
| P03 | **Players** `/players` | Danh sách người chơi, tên, nước, level, tình trạng | Tìm và lọc, mở `/players/:id` để xem hồ sơ và thành tích |
| P04 | **Match History** `/history` | Trận đấu, mùa, mode, 2 đối thủ, người thắng, điểm thưởng, thời gian | Lọc mùa/mode/người chơi; mở chi tiết trận |
| P05 | **Online Players** `/online` | Danh sách người chơi hoạt động gần đây, last seen | Xem trạng thái **mô phỏng**, không công bố là đang đăng nhập thật |

**Dashboard:** Không lưu số liệu giả trong frontend. Các thẻ thống kê và danh sách Top 3 phải lấy từ API.  
**Leaderboard:** Có quy tắc đồng điểm công khai; điểm và hạng luôn thuộc **một mùa cụ thể**.  
**Players:** Hồ sơ riêng có tên, quốc gia, level, trạng thái, tổng số trận thắng/thua, thống kê của mùa và các trận gần đây.  
**Match History:** Bản ghi trận cũ phải được giữ khi người chơi được vô hiệu hóa hay mùa giải đóng.  
**Online:** Vì không có đăng nhập người chơi, chỉ báo người chơi được Admin/ứng dụng **mô phỏng ping gần đây**, sử dụng cửa sổ thời gian định nghĩa sẵn.

### 4.2. Khu vực Admin — 6 trang

| Mã | Trang và đường dẫn | Dữ liệu hiển thị | Tương tác chính |
|---|---|---|---|
| A01 | **Admin Login** `/admin/login` | Form đăng nhập, thông báo sai/hết hạn | Đăng nhập/đăng xuất; Redis session với TTL |
| A02 | **Admin Dashboard** `/admin` | Thống kê quản trị, kết nối Redis, 5 kiểu dữ liệu, Activity Logs | Xem **Redis Data Overview** (chỉ đọc) và lịch sử thao tác |
| A03 | **Player Management** `/admin/players` | Danh sách, form quản lý người chơi | Thêm, sửa, vô hiệu hóa/kích hoạt lại; **không xóa cứng** dữ liệu lịch sử |
| A04 | **Match Management** `/admin/matches` | Form 1v1, danh sách trận, kết quả và score trước/sau | Ghi nhận kết quả Ranked/Friendly, chặn trùng matchId |
| A05 | **Game Management** `/admin/game` | Thông tin game, Ranked/Friendly, tab **Season Management** | Bật/tắt mode, tạo/kích hoạt/đóng season, xem season cũ |
| A06 | **System Settings** `/admin/settings` | Quy tắc điểm, cửa sổ online, cấu hình hiển thị | Chỉnh tham số hợp lệ, không cho tùy ý chạy lệnh Redis nguy hiểm |

**Admin Dashboard nên có hai khu vực con đặc biệt**:

- **Redis Data Overview**: minh họa String/Hash/List/Set/Sorted Set, số lượng hoặc trạng thái thật, ví dụ key tương ứng và câu lệnh Redis liên quan. Chỉ đọc qua backend, không expose mật khẩu, token session, nội dung nhạy cảm.
- **Activity Logs**: liệt kê sự kiện vận hành (tạo/cập nhật/vô hiệu hóa người chơi, kết quả trận, đổi mùa, chỉnh settings), lấy từ **Redis Stream**; đây là *nhật ký nghiệp vụ*, không phải Redis Slow Log.

### 4.3. Định hướng giao diện

Phong cách eSports chuyên nghiệp: nền tối, sắc tím/xanh, điểm nhấn vàng cho top 3, bố cục rõ ràng, sidebar Admin, top navigation công khai. Mỗi trang phải có loading/empty/error state, xác nhận thao tác có hậu quả, phân biệt trận Ranked/Friendly, mùa active/closed, người chơi active/inactive. Ưu tiên **tính đúng nghiệp vụ và tương tác thật** hơn số lượng trang hoặc hiệu ứng trang trí.

---

## 5. Quy tắc nghiệp vụ đã thống nhất

### BR-01. Một game, hai chế độ

Chỉ quản lý **1 trò chơi Battle Arena** trong V2:

- `ranked_1v1` — trận xếp hạng, **người thắng +300 điểm mặc định; người thua 0 điểm** (không trừ điểm).
- `friendly_1v1` — giao hữu, vẫn ghi lịch sử và số trận thắng/thua, **không thay đổi điểm xếp hạng**.
- Mọi trận có đúng 2 người chơi khác nhau, 1 người thắng, 1 người thua.
- Chế độ có thể bật/tắt bởi Admin; **không ghi trận mới vào mode đã tắt**.

### BR-02. Điểm thưởng thay đổi có kiểm soát

- Mức +300 là **mặc định**, cấu hình nằm ở phía server/Redis, không do trình duyệt quyết định.
- Admin có thể thay đổi mức điểm thắng Ranked của **mùa đang active** cho các **trận xảy ra sau thời điểm đổi**. Trận đã ghi giữ nguyên `pointsAwarded`.
- Friendly luôn có `pointsAwarded = 0`.
- Không cho phép tự ý chỉnh score leaderboard bằng form hồ sơ thông thường; nếu sau này cần điều chỉnh điểm thủ công phải thêm nghiệp vụ riêng có log, nhưng **không bắt buộc V2**.

### BR-03. Mùa giải

- Có nhiều mùa; mỗi mùa có ID, tên, trạng thái `draft` / `active` / `closed`, thông tin thời gian và quy tắc điểm của mùa.
- **Tối đa một mùa `active` tại một thời điểm.** Mùa cũ `closed` chỉ xem, không ghi thêm trận hoặc sửa bảng điểm.
- **Mỗi mùa có leaderboard riêng** và thống kê trận theo mùa. Điểm mùa mới bắt đầu ở **0**; người chơi đủ điều kiện được tham gia mùa mới. Việc mô phỏng điểm ban đầu qua các trận seed là hợp lệ.
- Season Management nằm trong **tab của Game Management**, không cần trang thứ 12.
- Kích hoạt mùa mới phải đóng mùa cũ một cách nhất quán, tránh khoảng thời gian cho ghi trận vào sai mùa.
- Dữ liệu mùa đã kết thúc được giữ để tra cứu lịch sử; không `FLUSHDB` khi reset mùa.

### BR-04. Người chơi

- Mỗi người chơi có `playerId` duy nhất, tên hiển thị, quốc gia, level, trạng thái active/inactive, thống kê tổng và theo mùa.
- Người chơi tạo mới trong mùa active được đưa vào danh sách tham gia mùa đó (điểm ban đầu 0).
- Khi **vô hiệu hóa**, người chơi không được tham gia trận mới/được ping online; **không xóa điểm/lịch sử cũ**. Chức năng `DELETE /players/:id` nếu có là **soft delete**.
- Người xem vẫn có thể tra hồ sơ người đã vô hiệu hóa nếu xuất hiện trong lịch sử; phải hiển thị nhãn rõ ràng.

### BR-05. Bảng xếp hạng và đồng điểm

- Điểm xếp hạng được lưu tại **Sorted Set của từng mùa**, không lưu lặp như score authoritative trong Hash hồ sơ.
- Hiển thị hạng = giá trị chỉ số trả về từ Redis `ZREVRANK` **+ 1**. Nếu chưa có trong bảng phải hiển thị *chưa được xếp hạng*.
- Khi **đồng điểm**, V2 dùng **thứ tự kỹ thuật cố định của Redis Sorted Set khi đọc giảm dần** để có thứ tự rõ ràng; không quảng cáo là đồng hạng thi đấu. Có ghi chú trên trang/FAQ.
- Leaderboard closed season có thể tra cứu, nhưng không được cập nhật nữa.

### BR-06. Ghi nhận trận đấu không trùng

- Mỗi trận có `matchId` duy nhất, `seasonId`, mode, hai người chơi, winner, loser, thời điểm và điểm thưởng.
- **Một `matchId` chỉ có thể được ghi thành công 1 lần**. Gửi lại payload cùng `matchId` trả thông tin trận cũ, không cộng điểm tiếp; payload khác với cùng `matchId` phải bị từ chối.
- Một lần ghi trận phải cập nhật **tất cả dữ liệu liên quan**: match detail, lịch sử, thắng/thua, điểm (nếu Ranked), chỉ mục tra cứu và activity event. Backend xử lý nguyên tử bằng **Lua script** trên Redis standalone, kiểm tra điều kiện trước khi ghi.
- Trận đã hoàn tất không cho sửa kết quả bằng UI trong V2; nếu cần sửa phải thiết kế quy trình hoàn tác riêng (ngoài phạm vi).

### BR-07. Online được định nghĩa trung thực

- Vì người chơi **không có login thật**, Online Players là **danh sách hoạt động mô phỏng**: Admin thực hiện `Simulate heartbeat` hoặc dữ liệu seed mô phỏng mốc truy cập.
- Redis giữ `lastSeen` theo timestamp. Một người được tính online nếu mốc này nằm trong cửa sổ cấu hình, ví dụ **120 giây**.
- Hết cửa sổ thì UI hiển thị offline dù member có thể vẫn còn trong Sorted Set; backend lọc theo timestamp, dọn key cũ khi cần.

### BR-08. Đăng nhập Admin

- Chỉ Admin đăng nhập. Mật khẩu được băm an toàn; không hardcode mật khẩu rõ trong source hoặc seed công khai.
- Phiên đăng nhập là **String key có TTL**; cookie HTTP-only, kiểm soát các API Admin phía backend; đăng xuất xóa session.
- Có chống brute-force/rate-limit ở đăng nhập. Không đưa password/session token/Redis credentials vào Redis Data Overview hoặc log.

### BR-09. Thời gian thực và độ tin cậy

- Khi ghi trận Ranked thành công, backend phát **Pub/Sub** để các client đang xem leaderboard biết cần tải lại.
- Browser nhận qua **SSE** (hoặc cơ chế tương đương được chốt trong spec kỹ thuật). Khi mất thông báo/mất kết nối vẫn phải **fetch dữ liệu thật** khi kết nối lại, vì Pub/Sub không có lịch sử sự kiện.
- Redis Streams dành cho **nhật ký nghiệp vụ** (có lưu trữ và giới hạn dung lượng); khác hoàn toàn Pub/Sub và Slow Log.

### BR-10. Sao lưu/phục hồi

- Redis giữ dữ liệu chính. Bật persistence và có bản **RDB** minh chứng; phục hồi lên **instance độc lập**, kiểm tra số lượng người chơi, mùa, leaderboard, lịch sử và một vài matchId, không chỉ kiểm tra có file dump.
- Không nhầm **export connection trong Redis Insight** với **backup dữ liệu Redis Server**.

---

## 6. Vì sao từng kiểu dữ liệu Redis xuất hiện?

| Cấu trúc | Nghiệp vụ thật | Ví dụ key định hướng | Những gì hiện lên UI | Lệnh minh họa |
|---|---|---|---|---|
| **String** | Session Admin có TTL, rate limit đăng nhập | `ba:v2:auth:session:<digest>` | Đăng nhập/đăng xuất, phiên hết hạn | `SET EX`, `GET`, `TTL`, `DEL`, `INCR` |
| **Hash** | Hồ sơ player, metadata trận, season, settings | `ba:v2:player:player01`, `ba:v2:match:<id>` | Chi tiết hồ sơ, form Admin, chi tiết trận | `HSET`, `HGETALL`, `HINCRBY`, `HMGET` |
| **List** | Danh sách ID trận gần đây | `ba:v2:matches:recent` | Mục Recent Matches/Match History | `LPUSH`, `LRANGE`, `LTRIM`, `LLEN` |
| **Set** | Tập ID người chơi, mùa giải, người tham dự | `ba:v2:players`, `ba:v2:seasons` | Số người, danh sách season | `SADD`, `SISMEMBER`, `SCARD`, `SMEMBERS` |
| **Sorted Set** | Leaderboard từng season, chỉ mục lịch sử theo thời gian, last seen | `ba:v2:season:<id>:leaderboard` | Top N, rank cá nhân, online mô phỏng | `ZADD`, `ZINCRBY`, `ZRANGE REV`, `ZREVRANK`, `ZSCORE`, `ZCOUNT` |
| **Stream** | Activity Logs của Admin và nghiệp vụ | `ba:v2:events` | Nhật ký trong Admin Dashboard | `XADD`, `XREVRANGE`, `XTRIM` |

**Lưu ý:** String, Hash, List, Set và Sorted Set là **5 cấu trúc cốt lõi cần có**. Streams là mở rộng ưu tiên. Cần giới hạn độ dài và giải thích Stream không phải nhật ký kiểm toán vĩnh viễn khi sử dụng trimming.

### 6.1. Năng lực Redis nâng cao cần minh họa

- **TTL:** phiên Admin tự hết hạn; kiểm tra qua Redis Insight hoặc `TTL` trên key session thử nghiệm, không chụp token thật để nộp.
- **Redis Search:** index Hash người chơi theo tên (TEXT), quốc gia (TAG), level (NUMERIC), trạng thái (TAG); tìm kiếm kết hợp điều kiện. Không nhầm với lọc *tên key* ở Browse.
- **Lua/Transaction:** cập nhật kết quả trận đấu nhiều key; tránh hai request giống nhau cộng điểm hai lần. Chứng minh chạy lặp không thay đổi score.
- **Pub/Sub:** sự kiện thay đổi leaderboard truyền tới web qua SSE. Chỉ phát event **sau khi ghi Redis thành công**.
- **Redis Streams:** lưu sự kiện tạo người chơi, ghi trận, đổi mùa và thay đổi cấu hình để Admin đọc lại.
- **Profiler/Slow Log/Database Analysis**: thuộc **Redis Insight/Redis Server phục vụ quản trị**, không nhất thiết phải lập trình tính năng tương đương trong website.

### 6.2. Các công nghệ KHÔNG bắt buộc trong V2

Redis JSON, Time Series, HyperLogLog, Bitmap, Vector Set, Geospatial. Nhóm có thể giải thích trong mục hướng phát triển, **không cố thêm key vô nghĩa** chỉ để đủ danh sách.

---

## 7. Thiết kế dữ liệu ở mức khái niệm

### 7.1. Đối tượng nghiệp vụ

1. **Game:** 1 game Battle Arena và các chế độ `ranked_1v1`, `friendly_1v1`.
2. **Player:** hồ sơ/định danh riêng, trạng thái và thống kê tổng.
3. **Season:** đợt xếp hạng, có vòng đời draft → active → closed.
4. **Season Participants:** tập người đủ điều kiện tham gia một mùa.
5. **Season Leaderboard:** điểm Ranked của từng người theo mùa, khởi đầu 0.
6. **Season Player Stats:** số thắng/thua Ranked và Friendly trong mùa.
7. **Match:** bản ghi bất biến của một trận đã xác nhận.
8. **Match History Index:** cách tra cứu trận theo toàn hệ thống, mùa hoặc người chơi.
9. **Online Simulation:** timestamp hoạt động mô phỏng.
10. **Admin Session:** xác thực có TTL.
11. **Event Stream:** sự kiện nghiệp vụ cho Admin.

### 7.2. Quy ước Redis

- Dùng một **namespace mới**: `ba:v2:`. **Không sử dụng lại hoặc sửa đè** `game:*` của báo cáo giữa kỳ.
- Chạy trên **Redis V2 instance/container và volume mới**, được Redis Insight và ARDM cùng truy cập khi so sánh.
- Các phần ngăn bởi dấu `:` là quy ước tên key, **không phải bảng/cấu trúc cha-con vật lý**.
- Định danh `playerId`, `seasonId`, `matchId` được backend kiểm tra định dạng; không được chấp nhận key name tùy ý từ trình duyệt.
- Redis không có JOIN/foreign key tự động: backend phải giữ các tham chiếu nhất quán.
- Không để dữ liệu quan trọng chỉ sống trong bộ nhớ không có backup; demo có RDB và volume persistence.

### 7.3. Dữ liệu mẫu

Định hướng seed mặc định: **24 hồ sơ người chơi**, **2 mùa** (một mùa đã đóng, một mùa active), **ít nhất 30 trận** gồm cả Ranked và Friendly, có cả người điểm 0, người đồng điểm, người inactive, người ở nhiều khoảng level/quốc gia. Số lượng này là **mục tiêu dữ liệu V2**, không phải số liệu đã triển khai. Seed phải lặp lại được không nhân đôi điểm/trận; **không tự động FLUSHDB**.

**Vì sao phải có nhiều dữ liệu hơn giữa kỳ?** Đủ để thử Top 5/10, phân trang, thống kê, lọc, Search, xếp hạng qua 2 mùa, trực quan hóa phân bố key và xử lý trường hợp ngoại lệ. Không cần giả lập hàng triệu người chơi.

### 7.4. Hình dung luồng dữ liệu

```text
Browser (khách/ Admin)
        │ HTTPS/HTTP (local)
        ▼
Frontend React + Vite
        │ REST API + SSE
        ▼
Backend Express + Redis client
        │ kiểm tra phân quyền, luật trận, season, matchId
        ▼
Redis Server V2 (nguồn dữ liệu chính)
        ├─ String: session/TTL
        ├─ Hash: player/match/season/settings
        ├─ List: recent matches
        ├─ Set: player IDs/season IDs/participants
        ├─ Sorted Set: leaderboard/online/time index
        ├─ Stream: activity logs
        ├─ Search index: query player
        └─ Pub/Sub: leaderboard changed

Redis Insight ── kết nối riêng để quan sát, quản trị, kiểm chứng
ARDM          ── kết nối cùng Redis để so sánh GUI
```

Redis Insight **không** đứng giữa frontend và backend.

---

## 8. Kịch bản minh họa trong buổi báo cáo/đồ án

### Demo 1 — 5 kiểu dữ liệu cơ bản

1. Admin đăng nhập; chứng minh **String + TTL** của session bằng một session thử nghiệm bảo mật.
2. Admin thêm player; mở Redis Insight để thấy **Hash** hồ sơ và **Set** ID player.
3. Admin ghi trận Ranked 1v1 thắng +300; xem **Hash** match, thống kê thắng/thua.
4. Người xem mở Leaderboard; điểm và hạng mới lấy từ **Sorted Set** của mùa.
5. Mở Match History; trận mới ở đầu **List** recent matches, xem chi tiết trận qua Hash.

### Demo 2 — Ranked vs Friendly

- Với **Ranked**, chứng minh điểm, hạng, wins/losses và history đều đúng.
- Với **Friendly**, chứng minh có bản ghi và tăng thắng/thua nhưng **không đổi score**.
- Gửi lại cùng matchId; lần sau **không cộng thêm điểm**, dữ liệu bất biến.

### Demo 3 — Nhiều mùa giải

- Đọc leaderboard Season 1 (closed), leaderboard Season 2 (active).
- Kết thúc Season 2, tạo/kích hoạt Season 3; Season 2 không thể ghi trận mới.
- Đối chiếu các mùa trong Redis Insight, điểm Season 3 khởi tạo 0.

### Demo 4 — Redis Insight chuyên sâu

- Databases → Browse → Hash/Set/List/ZSet → TTL → Workbench → CLI.
- Search: tìm người VN có level ≥ 10 hoặc tìm TEXT theo tên.
- Database Analysis: phân tích số key/bộ nhớ, ghi thời điểm và phạm vi quét.
- Profiler: mở theo dõi, thao tác website và quan sát lệnh backend.
- Pub/Sub: quan sát channel thay đổi leaderboard; website khác cập nhật qua SSE.
- Slow Log: kiểm tra ngưỡng và bản ghi. **Không gọi mọi lệnh xuất hiện là lệnh chậm thật** khi đang đặt ngưỡng 0 để minh họa.
- Streams: đọc nhật ký nghiệp vụ từ `ba:v2:events` và so với màn hình Activity Logs.

### Demo 5 — So sánh GUI Redis Insight và ARDM

Cùng server, cùng key, cùng thời điểm: kết nối, duyệt Hash/ZSet, chạy truy vấn Top 5, xem thao tác sửa, trình bày kết quả. Với Search, memory analysis, profiler hoặc chức năng khác **chỉ ghi là “đã kiểm tra” khi đã thử thật trên từng GUI**; không suy đoán ARDM có/không có tính năng. Tiêu chí tập trung vào **thao tác và độ thuận tiện**, không tuyên bố công cụ nhanh hơn nếu chưa benchmark có kiểm soát.

### Demo 6 — Backup/Restore

Tạo snapshot RDB sau khi có dữ liệu thật; phục hồi vào Redis instance khác. Trên instance phục hồi, đối chiếu ít nhất 1 player, 1 trận, leaderboard 2 mùa, số member, Stream và khả năng tìm kiếm sau khi kiểm tra/rebuild index nếu cần.

---

## 9. Nội dung báo cáo Word/PDF cuối kỳ

**Phần nghiên cứu Redis Insight từ giữa kỳ phải được giữ và tiếp tục phát triển**, không chỉ viết 5 kiểu dữ liệu. Bố cục gợi ý:

1. Tổng quan Redis và Redis Insight.
2. Cài đặt, Docker, kết nối và môi trường.
3. **Các chức năng của Redis Insight**: Databases, Browse, Hash/Set/List/ZSet, TTL, Workbench, CLI, Search, Analyze/Database Analysis, Profiler, Pub/Sub, Slow Log, đánh giá công cụ.
4. So sánh Redis Insight với Another Redis Desktop Manager.
5. Phân tích bài toán, use case, quy tắc nghiệp vụ, Redis V2 và mô hình key.
6. Dữ liệu và truy vấn Redis; transaction, Search, Streams, Pub/Sub.
7. Kiến trúc và xây dựng website 11 trang, các API và kết quả thực tế.
8. **Áp dụng Redis Insight vào dữ liệu của website đã chạy**: kiểm chứng các thao tác phát sinh từ frontend/backend, khác Chương 3 lý thuyết và khảo sát công cụ.
9. Import/Export, Backup/Restore.
10. Kiểm thử, đánh giá, giới hạn, kết luận và hướng phát triển.

Kèm bảng phân công và mức độ hoàn thành thành viên; ảnh minh chứng, hướng dẫn chạy, danh sách lệnh demo, tài liệu tham khảo, mã nguồn và tệp backup. **Không sao chép nguyên ảnh giữa kỳ rồi gắn chú thích “dữ liệu V2” nếu thực tế ảnh là V1.** Có thể giữ hình V1 ở mục lịch sử nghiên cứu và gắn nhãn rõ.

---

## 10. Tiêu chí “đủ hoàn thiện để nộp”

| Mã | Tiêu chí | Cách chứng minh |
|---|---|---|
| AC-01 | Có 11 trang chức năng chính, gồm 5 public + 6 Admin | Truy cập từng route, không trang rỗng |
| AC-02 | Tất cả số liệu nghiệp vụ lấy từ Redis V2 | Tạo thay đổi trên web, Redis Insight đọc ra tương ứng |
| AC-03 | 5 kiểu Redis cơ bản có nghiệp vụ thật | Mỗi kiểu có key, dữ liệu, lệnh và màn hình liên quan |
| AC-04 | Ranked/Friendly phân biệt đúng | Đọc điểm trước/sau, wins/losses, lịch sử |
| AC-05 | Hỗ trợ nhiều mùa | Season cũ xem được; chỉ season active nhận trận |
| AC-06 | Chống cộng điểm trùng | Gửi cùng matchId 2 lần và kiểm tra điểm |
| AC-07 | Admin authentication và soft-delete | Không đăng nhập không sửa được; inactive không tham gia trận |
| AC-08 | Có Search, TTL, Stream, Pub/Sub/SSE và Lua | Có kết quả chạy thực tế và ảnh minh chứng |
| AC-09 | Có so sánh Redis Insight vs ARDM cùng dữ liệu | Bảng so sánh + ảnh lệnh tương đương |
| AC-10 | Có RDB và thử restore độc lập | Kết quả đối chiếu các key sau restore |
| AC-11 | Có source, README chạy Docker, seed, test, báo cáo Word/PDF, phân công | Kiểm tra đủ tệp trong bộ nộp |

**Nguyên tắc ưu tiên thực hiện:** Không trì hoãn phần cốt lõi để đánh bóng UI hoặc tạo trang phụ. Làm đúng Players → Seasons/Leaderboard → Matches → Auth → History → các chức năng nâng cao → minh chứng Redis Insight/ARDM → backup/report.

---

## 11. Hướng dẫn phối hợp nhóm và với Codex

- **Cả nhóm đọc tài liệu này trước** để thống nhất đề tài, vai trò người dùng, luật điểm, mùa giải và phạm vi chức năng.
- **Codex phải đọc đồng thời** file `02_Battle_Arena_V2_SRS_Technical_Spec_For_Codex.md` để có endpoint, key schema, dữ liệu mẫu, tiêu chí test và đường dẫn file.
- Nếu có chỗ chưa rõ, **SRS kỹ thuật là nguồn quy định chi tiết cách triển khai**; tài liệu hiện tại là nguồn quy định **mục tiêu và quy tắc nghiệp vụ**. Không được dùng lựa chọn kỹ thuật để âm thầm thay đổi luật nghiệp vụ ở đây.
- Không tự ý thay số trang chính, thêm đăng nhập player, chuyển sang PostgreSQL/MongoDB làm CSDL chính, bỏ Redis Search/Stream hoặc đổi Ranked/Friendly mà chưa cập nhật đồng bộ **cả hai tài liệu**.
- Khi hoàn thành một chức năng phải có ít nhất: UI gọi API thật → key Redis → test → minh chứng Redis Insight. Thông báo “hoàn thành” chỉ khi có kết quả chạy thực tế.
- Khi báo cáo, phân biệt rõ **đã làm**, **đang làm**, **đề xuất mở rộng**, và giới hạn thử nghiệm.

---

## 12. Nguồn tham khảo kỹ thuật để đối chiếu

- Redis Leaderboards: https://redis.io/docs/latest/develop/use-cases/leaderboard/
- Redis Sorted Set: https://redis.io/docs/latest/develop/data-types/sorted-sets/
- Redis Search / FT.CREATE: https://redis.io/docs/latest/commands/ft.create/
- Redis Lua scripting: https://redis.io/docs/latest/develop/programmability/eval-intro/
- Redis Insight on Docker: https://redis.io/docs/latest/operate/redisinsight/install/install-on-docker/
- Redis Open Source 8 (tích hợp Redis Search): https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/redisos-8.0-release-notes/

---

**Quyết định kết thúc:** Xây dựng **Battle Arena V2** mới, có **11 trang chính**, **1 game**, **2 chế độ** (`ranked_1v1`, `friendly_1v1`), **nhiều mùa**, **Redis là CSDL chính**, **Redis Insight là công cụ quản trị trọng tâm**, **ARDM dùng so sánh GUI**, **5 kiểu Redis cơ bản + TTL/Search/Lua/PubSub/Streams**, có test, Docker, backup và báo cáo cuối kỳ.
