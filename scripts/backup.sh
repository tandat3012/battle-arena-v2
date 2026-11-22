#!/usr/bin/env bash
# Sao lưu RDB của Redis V2: BGSAVE → đợi hoàn tất (LASTSAVE + INFO persistence) → copy dump.rdb ra backups/ kèm checksum.
set -euo pipefail
cd "$(dirname "$0")/.."

CID=$(docker compose ps -q redis-v2)
[ -n "$CID" ] || { echo "redis-v2 chưa chạy (docker compose up -d redis-v2)"; exit 1; }
cli() { docker exec "$CID" redis-cli "$@"; }

# Chỉ chạy trên instance V2 (có dữ liệu namespace ba:v2:)
[ "$(cli EXISTS ba:v2:players)" = "1" ] || { echo "Không thấy ba:v2:players — từ chối, có thể không phải Redis V2"; exit 1; }

BEFORE=$(cli LASTSAVE)
cli BGSAVE >/dev/null
echo -n "[backup] BGSAVE đang chạy"
for _ in $(seq 1 60); do
  sleep 1; echo -n "."
  INFO=$(cli INFO persistence | tr -d '\r')
  if [ "$(cli LASTSAVE)" != "$BEFORE" ] && grep -q '^rdb_bgsave_in_progress:0' <<<"$INFO"; then
    grep -q '^rdb_last_bgsave_status:ok' <<<"$INFO" || { echo; echo "BGSAVE lỗi"; exit 1; }
    echo " xong"; break
  fi
done
[ "$(cli LASTSAVE)" != "$BEFORE" ] || { echo; echo "Hết thời gian chờ BGSAVE"; exit 1; }

TS=$(date +%Y%m%d-%H%M%S)
OUT="backups/battle-arena-v2-$TS.rdb"
mkdir -p backups
docker cp "$CID:/data/dump.rdb" "$OUT" >/dev/null
sha256sum "$OUT" > "$OUT.sha256"
{
  echo "file: $OUT"
  echo "created: $(date -Iseconds)"
  echo "redis_version: $(cli INFO server | tr -d '\r' | grep '^redis_version:' | cut -d: -f2)"
  echo "players: $(cli SCARD ba:v2:players)"
  echo "seasons: $(cli SMEMBERS ba:v2:seasons | sort | tr '\n' ' ')"
  echo "active_season: $(cli GET ba:v2:season:active)"
  echo "matches: $(cli SCARD ba:v2:match:ids)"
  echo "events: $(cli XLEN ba:v2:events)"
  echo "sha256: $(cut -d' ' -f1 "$OUT.sha256")"
} > "$OUT.txt"
echo "[backup] $OUT ($(du -h "$OUT" | cut -f1))"
cat "$OUT.txt"
