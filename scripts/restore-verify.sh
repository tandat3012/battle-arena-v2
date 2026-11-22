#!/usr/bin/env bash
# Phục hồi RDB lên một Redis ĐỘC LẬP (volume trống, tắt AOF để không bị AOF cũ ghi đè) rồi đối chiếu với Redis V2 gốc.
# Dùng: scripts/restore-verify.sh [file.rdb] [--keep]   (--keep: giữ instance ở 127.0.0.1:6381 cho ARDM/CLI)
set -euo pipefail
cd "$(dirname "$0")/.."

RDB=""; KEEP=0
for a in "$@"; do [ "$a" = "--keep" ] && KEEP=1 || RDB="$a"; done
RDB=${RDB:-$(ls -t backups/*.rdb 2>/dev/null | head -1)}
[ -f "$RDB" ] || { echo "Không tìm thấy file RDB (chạy scripts/backup.sh trước)"; exit 1; }
[ -f "$RDB.sha256" ] && sha256sum -c "$RDB.sha256" >/dev/null && echo "[restore] checksum OK: $RDB"

IMAGE=redis:8.8.4; NAME=ba-v2-restore; VOL=ba-v2-restore-data
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume rm "$VOL" >/dev/null 2>&1 || true
docker volume create "$VOL" >/dev/null
# Chép RDB vào volume trống KHI instance chưa chạy
docker run --rm -v "$VOL":/data -v "$PWD/$(dirname "$RDB")":/b:ro "$IMAGE" cp "/b/$(basename "$RDB")" /data/dump.rdb
docker run -d --name "$NAME" -p 127.0.0.1:6381:6379 -v "$VOL":/data "$IMAGE" \
  redis-server --appendonly no --dir /data --dbfilename dump.rdb --save "" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" redis-cli PING 2>/dev/null | grep -q PONG && break; sleep 0.5; done

SRC=$(docker compose ps -q redis-v2 || true)
r() { docker exec "$NAME" redis-cli "$@" | tr -d '\r'; }
s() { [ -n "$SRC" ] && docker exec "$SRC" redis-cli "$@" | tr -d '\r' || echo "(nguồn không chạy)"; }

# Nếu index Search chưa có sau restore → tạo lại idempotent (cùng schema với init-redis)
if ! r FT._LIST | grep -q 'idx:ba:v2:players'; then
  echo "[restore] chưa có index Search → tạo lại"
  r FT.CREATE idx:ba:v2:players ON HASH PREFIX 1 ba:v2:player: SCHEMA displayName TEXT country TAG level NUMERIC SORTABLE status TAG >/dev/null
  sleep 1
fi

ACTIVE=$(r GET ba:v2:season:active)
LATEST=$(r LINDEX ba:v2:matches:recent 0)
PASS=0; FAIL=0
REPORT="docs/restore-verification.md"
LINES=()
check() { # label | lệnh trên restore | (giá trị gốc tại thời điểm chạy, chỉ tham khảo)
  local label="$1"; shift
  local got; got=$(r "$@" | tr '\n' ' ' | sed 's/ $//')
  local src; src=$(s "$@" | tr '\n' ' ' | sed 's/ $//')
  local st="OK"; [ -n "$got" ] || st="FAIL"
  [ "$st" = "OK" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
  printf '%-4s %-40s %s\n' "$st" "$label" "$got"
  LINES+=("| $st | \`$*\` | $got | $src |")
}

echo "--- Kiểm tra trên instance restore (127.0.0.1:6381) ---"
check "PING" PING
VER=$(r INFO server | grep '^redis_version:'); printf '%-4s %-40s %s\n' OK "INFO server" "$VER"; PASS=$((PASS+1))
LINES+=("| OK | \`INFO server\` | $VER | $(s INFO server | grep '^redis_version:') |")
check "Số người chơi" SCARD ba:v2:players
check "Các mùa" SMEMBERS ba:v2:seasons
check "Mùa active" GET ba:v2:season:active
for SEASON in $(r SMEMBERS ba:v2:seasons | sort); do
  check "Top 5 $SEASON" ZRANGE "ba:v2:season:$SEASON:leaderboard" 0 4 REV WITHSCORES
done
check "Hồ sơ player01" HMGET ba:v2:player:player01 displayName totalWins totalLosses status
check "Trận mới nhất" HMGET "ba:v2:match:$LATEST" seasonId mode winnerId pointsAwarded
check "Số trận" SCARD ba:v2:match:ids
check "LLEN recent" LLEN ba:v2:matches:recent
check "XLEN events" XLEN ba:v2:events
check "Sự kiện mới nhất" XREVRANGE ba:v2:events + - COUNT 1
check "FT.SEARCH VN lv>=10" FT.SEARCH idx:ba:v2:players "@country:{VN} @level:[10 +inf] @status:{active}" NOCONTENT

# So khớp số lượng chính với Redis V2 gốc (nếu gốc chưa đổi sau khi backup thì phải bằng nhau)
MISMATCH=""
if [ -n "$SRC" ]; then
  for k in "SCARD ba:v2:players" "SCARD ba:v2:match:ids" "XLEN ba:v2:events" "GET ba:v2:season:active"; do
    [ "$(r $k)" = "$(s $k)" ] || MISMATCH+=" [$k: restore=$(r $k) gốc=$(s $k)]"
  done
fi

{
  echo ""
  echo "## Lần kiểm tra $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo ""
  echo "- File: \`$RDB\` (sha256 \`$(sha256sum "$RDB" | cut -c1-16)…\`)"
  echo "- Instance restore: \`$IMAGE\`, volume trống \`$VOL\`, \`appendonly no\`, cổng 127.0.0.1:6381"
  echo "- Kết quả: **$PASS OK / $FAIL FAIL**${MISMATCH:+ — khác với Redis gốc hiện tại (gốc có thể đã đổi sau khi backup):$MISMATCH}"
  echo ""
  echo "| Trạng thái | Lệnh | Kết quả trên restore | Redis V2 gốc lúc kiểm tra |"
  echo "|---|---|---|---|"
  printf '%s\n' "${LINES[@]}"
} >> "$REPORT"

echo "--- $PASS OK / $FAIL FAIL${MISMATCH:+ · khác gốc:$MISMATCH} · đã ghi $REPORT ---"
if [ "$KEEP" = 1 ]; then
  echo "Instance restore vẫn chạy ở 127.0.0.1:6381 (dừng: docker rm -f $NAME && docker volume rm $VOL)"
else
  docker rm -f "$NAME" >/dev/null; docker volume rm "$VOL" >/dev/null
fi
[ "$FAIL" = 0 ]
