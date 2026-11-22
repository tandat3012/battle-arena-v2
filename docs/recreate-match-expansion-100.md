# Tái tạo bộ dữ liệu mô phỏng 100 trận

## Phạm vi an toàn

Manifest này chứa 66 trận mô phỏng, không phải lịch sử trận thật. Chỉ phát lại nó trên Redis clone được phục hồi từ bản backup. **Không dùng Redis V2 tại cổng 6380 làm target.** Chưa có phê duyệt thì không gửi manifest tới API chính.

Manifest cố định ở `data/match-expansion-66.json`; không tạo lại UUID. Nếu đã gửi một phần, phát lại cùng payload và cùng `matchId`: API sẽ trả kết quả idempotent. Không đổi thứ tự hai người chơi, winner, mode, season hoặc ID sau khi đã gửi.

## Clone hiện có

Trong phiên dry-run này, bản sao vẫn chạy:

- Redis: `127.0.0.1:6382`, container `ba-v2-match-dryrun-redis`
- API: `127.0.0.1:3003`, container `ba-v2-match-dryrun-api-auth`
- Network riêng: `ba-v2-match-dryrun-net`
- RDB ban đầu được chép vào `/tmp/ba-v2-match-dryrun.J0gCH7ar/data/dump.rdb`; sau dry-run, clone đã lưu trạng thái 100 trận vào **bản sao** này.

Redis clone dùng bind mount trong `/tmp`, không dùng Docker volume. Container clone đang chạy để xem dữ liệu; nếu máy tự dọn `/tmp`, cần tạo lại clone từ backup gốc trước khi replay. Không xóa container/volume để thực hiện các bước này.

## Dựng một clone mới

Chỉ chạy phần này nếu các cổng và tên mới đã được chọn riêng, không trùng với container/port đang dùng. Dùng một thư mục tạm mới, sao chép RDB thay vì di chuyển file gốc:

```bash
DRYRUN_DIR="$(mktemp -d /tmp/ba-v2-replay.XXXXXXXX)"
mkdir -p "$DRYRUN_DIR/data"
cp backups/battle-arena-v2-20261122-150730.rdb "$DRYRUN_DIR/data/dump.rdb"
sha256sum backups/battle-arena-v2-20261122-150730.rdb "$DRYRUN_DIR/data/dump.rdb"
```

Hai SHA-256 phải giống nhau. Tạo Redis clone với tên, network và cổng localhost mới:

```bash
docker network create ba-v2-replay-net
docker run -d \
  --name ba-v2-replay-redis \
  --network ba-v2-replay-net \
  --network-alias dryrun-redis \
  -p 127.0.0.1:6382:6379 \
  -v "$DRYRUN_DIR/data:/data" \
  redis:8.8.4 redis-server --appendonly no --dir /data --dbfilename dump.rdb --save ""
```

Nếu cổng 6382 đang được clone hiện tại sử dụng, chọn cổng khác và cập nhật URL API tương ứng. Trước khi chạy API, xác nhận clone có 34 trận, mùa 1 có 16, mùa 2 có 18, active pointer là `s2026_02`, và đúng 23 participants.

Chạy API trên cùng network, bind cổng localhost riêng, đặt `REDIS_URL=redis://dryrun-redis:6379` và bắt buộc `SEED_ON_START=false`. API khởi động có thể tạo/kiểm tra Search index; không chạy script seed. Cấu hình Admin lấy từ `.env` hiện có, không thay mật khẩu. Docker CLI `--env-file` không xử lý dấu nháy như Compose; nếu dùng Docker CLI, hãy tạo file env tạm chỉ có quyền đọc/ghi cho chủ máy và bỏ đúng dấu nháy ngoài giá trị, không đưa file đó vào Git hoặc báo cáo.

## Gửi manifest qua API

Dùng đăng nhập Admin hiện có và Origin được cho phép (`http://localhost:5173`). Ví dụ Python dưới đây hỏi mật khẩu ẩn, lấy cookie trong bộ nhớ, gửi tuần tự từng hàng và chỉ in kết quả; không ghi mật khẩu hay cookie vào file:

```python
import getpass, json, os, urllib.request, urllib.error
from http.cookiejar import CookieJar

base = os.environ.get("BA_API_URL", "http://127.0.0.1:3003")
origin = "http://localhost:5173"
username = input("Admin username: ")
password = getpass.getpass("Admin password: ")
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

def post(path, body):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Origin": origin},
        method="POST",
    )
    with opener.open(req) as response:
        return response.status, json.loads(response.read())

status, _ = post("/api/auth/login", {"username": username, "password": password})
if status != 200:
    raise SystemExit(f"Admin login failed: HTTP {status}")

manifest = json.load(open("data/match-expansion-66.json", encoding="utf-8"))
created = retried = 0
for match in manifest["matches"]:
    payload = {k: match[k] for k in (
        "matchId", "seasonId", "mode", "player1Id", "player2Id", "winnerId"
    )}
    status, body = post("/api/admin/matches", payload)
    if status == 201:
        created += 1
    elif status == 200 and body["data"]["alreadyProcessed"]:
        retried += 1
    else:
        raise SystemExit(f"Unexpected response for {payload['matchId']}: HTTP {status}")

print(f"Manifest rows accepted: {created} newly created, {retried} idempotent retries")
```

Lưu đoạn mã vào file tạm hoặc chạy trong Python REPL; không sửa manifest. API chỉ nhận sáu trường trong payload; metadata ở cấp ngoài manifest không gửi lên route.

## Xác minh sau khi gửi

Trên Redis clone, kiểm tra các bộ đếm:

```bash
redis-cli -h 127.0.0.1 -p 6382 SCARD ba:v2:match:ids
redis-cli -h 127.0.0.1 -p 6382 ZCARD ba:v2:season:s2026_01:matches
redis-cli -h 127.0.0.1 -p 6382 ZCARD ba:v2:season:s2026_02:matches
redis-cli -h 127.0.0.1 -p 6382 GET ba:v2:season:active
redis-cli -h 127.0.0.1 -p 6382 XLEN ba:v2:events
redis-cli -h 127.0.0.1 -p 6382 FT.SEARCH idx:ba:v2:players '@status:{active}' NOCONTENT LIMIT 0 100
```

Kết quả kỳ vọng là `100`, `16`, `84`, `s2026_02`; Search trả đủ 23 người chơi active. Ngoài tổng số Stream, phải đếm event `match.recorded` theo `entityId`: đúng 66 ID manifest, mỗi ID đúng một event. So sánh hash của 34 trận cũ, thống kê từng người, leaderboard, player/season history và dữ liệu mùa 1 với baseline trước khi xem dry-run hoàn tất.

Sau khi duyệt riêng việc áp dụng dữ liệu thật, cần tạo backup mới của Redis V2 chính, xác minh checksum/restore, gửi cùng manifest ổn định qua API chính, rồi chạy lại toàn bộ đối chiếu. Tài liệu này **không cấp phép** ghi manifest vào Redis chính.
