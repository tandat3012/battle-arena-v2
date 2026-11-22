#!/usr/bin/env bash
# Nạp RDB vào một Redis độc lập, không dùng hoặc xóa Docker volume, rồi so sánh
# toàn bộ key/value ba:v2: bền vững với Redis V2 nguồn từ cùng thời điểm backup.
# Dùng: scripts/restore-verify.sh [file.rdb] [--keep]
# --keep giữ container và thư mục tạm để mở Redis restore ở 127.0.0.1:6381.
set -euo pipefail
cd "$(dirname "$0")/.."

RDB=""; KEEP=0
for a in "$@"; do [ "$a" = "--keep" ] && KEEP=1 || RDB="$a"; done
if [ -z "$RDB" ]; then
  RDB=$(find backups -maxdepth 1 -type f -name '*.rdb' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)
fi
[ -n "$RDB" ] && [ -f "$RDB" ] || { echo "Không tìm thấy file RDB (chạy scripts/backup.sh trước)" >&2; exit 1; }
[ -f "$RDB.sha256" ] || { echo "Thiếu checksum: $RDB.sha256" >&2; exit 1; }
sha256sum -c "$RDB.sha256"

SRC=$(docker compose ps -q redis-v2)
[ -n "$SRC" ] || { echo "Redis V2 nguồn chưa chạy; cần nguồn để đối chiếu dữ liệu." >&2; exit 1; }
[ "$(docker inspect -f '{{.State.Running}}' "$SRC")" = "true" ] || { echo "Redis V2 nguồn không ở trạng thái running." >&2; exit 1; }

IMAGE=redis:8.8.4
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/ba-v2-restore.XXXXXXXX")
DATA_DIR="$WORK_DIR/data"
NAME="ba-v2-restore-${BASHPID}-${RANDOM}"
KEEP_INSTANCE=0

cleanup() {
  if [ "$KEEP_INSTANCE" -ne 1 ]; then
    if [ "$(docker inspect -f '{{ index .Config.Labels "com.battlearena.restore-run" }}' "$NAME" 2>/dev/null || true)" = "$WORK_DIR" ]; then
      docker rm -f "$NAME" >/dev/null 2>&1 || true
    fi
    rm -rf -- "$WORK_DIR"
  fi
}
trap cleanup EXIT

mkdir -p "$DATA_DIR"
cp "$RDB" "$DATA_DIR/dump.rdb"
chmod 777 "$DATA_DIR"

docker run -d --name "$NAME" --label "com.battlearena.restore-run=$WORK_DIR" -p 127.0.0.1:6381:6379 \
  -v "$DATA_DIR:/data" "$IMAGE" \
  redis-server --appendonly no --dir /data --dbfilename dump.rdb --save "" >/dev/null

r() { docker exec "$NAME" redis-cli --raw "$@"; }
s() { docker exec "$SRC" redis-cli --raw "$@"; }
rj() { docker exec "$NAME" redis-cli --json "$@"; }
sj() { docker exec "$SRC" redis-cli --json "$@"; }

READY=0
for _ in $(seq 1 40); do
  if [ "$(r PING 2>/dev/null || true)" = "PONG" ]; then READY=1; break; fi
  sleep 0.5
done
[ "$READY" -eq 1 ] || { echo "Redis restore không sẵn sàng; xem: docker logs $NAME" >&2; exit 1; }

PASS=0; FAIL=0
REPORT="${REPORT:-docs/restore-verification.md}"
LINES=()
record() {
  local status="$1" label="$2" got="$3" expected="$4"
  printf '%-4s %-42s %s\n' "$status" "$label" "$got"
  LINES+=("| $status | $label | $got | $expected |")
  if [ "$status" = "OK" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
}
same_command() {
  local label="$1"; shift
  local restored source status
  restored=$(r "$@" | tr '\n' ' ' | sed 's/ $//')
  source=$(s "$@" | tr '\n' ' ' | sed 's/ $//')
  status=OK; [ "$restored" = "$source" ] || status=FAIL
  record "$status" "$label" "$restored" "$source"
}
same_sorted_members() {
  local label="$1"; shift
  local restored source status
  restored=$(r "$@" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  source=$(s "$@" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
  status=OK; [ "$restored" = "$source" ] || status=FAIL
  record "$status" "$label" "$restored" "$source"
}
same_redis_version() {
  local restored source status
  restored=$(r INFO server | tr -d '\r' | sed -n 's/^redis_version://p')
  source=$(s INFO server | tr -d '\r' | sed -n 's/^redis_version://p')
  status=OK; [ -n "$restored" ] && [ "$restored" = "$source" ] || status=FAIL
  record "$status" "Redis version" "$restored" "$source"
}

# Canonicalize logical Redis values instead of comparing RDB/DUMP encodings.
# redis-cli --json escapes arbitrary string contents, so values containing tabs
# or newlines remain unambiguous during comparison.
canonical_json() {
  local type="$1"
  python3 -c '
import json, sys

kind = sys.argv[1]
value = json.load(sys.stdin)

def pairs(value, kind):
    if isinstance(value, dict):
        return list(value.items())
    if isinstance(value, list) and len(value) % 2 == 0:
        return list(zip(value[::2], value[1::2]))
    raise ValueError(f"unexpected {kind} response shape")

if kind == "string":
    result = value
elif kind == "hash":
    result = sorted(pairs(value, kind), key=lambda pair: str(pair[0]))
elif kind == "set":
    if not isinstance(value, list):
        raise ValueError("unexpected set response shape")
    result = sorted(value, key=str)
elif kind == "list":
    if not isinstance(value, list):
        raise ValueError("unexpected list response shape")
    result = value
elif kind == "zset":
    if isinstance(value, list) and value and all(isinstance(row, list) and len(row) == 2 for row in value):
        members = value
    else:
        members = pairs(value, kind)
    # Redis scores are IEEE-754 doubles; hex() compares their exact numeric value
    # without depending on textual formatting such as 1, 1.0, or 1e0.
    result = sorted(
        ((member, float(score).hex()) for member, score in members),
        key=lambda pair: str(pair[0]),
    )
elif kind == "stream":
    if not isinstance(value, list):
        raise ValueError("unexpected stream response shape")
    result = []
    for row in value:
        if not isinstance(row, list) or len(row) != 2:
            raise ValueError("unexpected stream entry shape")
        entry_id, fields = row
        # A stream entry is identified by its ID; compare every field/value pair.
        result.append((entry_id, sorted(pairs(fields, "stream fields"), key=lambda pair: str(pair[0]))))
else:
    raise ValueError(f"unsupported Redis type: {kind}")

print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
' "$type"
}

logical_value() {
  local cli="$1" type="$2" key="$3"
  case "$type" in
    string) "$cli" GET "$key" | canonical_json string ;;
    hash)   "$cli" HGETALL "$key" | canonical_json hash ;;
    set)    "$cli" SMEMBERS "$key" | canonical_json set ;;
    list)   "$cli" LRANGE "$key" 0 -1 | canonical_json list ;;
    zset)   "$cli" ZRANGE "$key" 0 -1 WITHSCORES | canonical_json zset ;;
    stream) "$cli" XRANGE "$key" - + | canonical_json stream ;;
    *) return 2 ;;
  esac
}

sha256_text() {
  printf '%s' "$1" | sha256sum | cut -d' ' -f1
}

search_all_active_ids() {
  local cli="$1" initial total full full_total ids returned
  initial=$("$cli" FT.SEARCH idx:ba:v2:players '@status:{active}' NOCONTENT) || return 1
  total="${initial%%$'\n'*}"
  [[ "$total" =~ ^[0-9]+$ ]] || { echo "FT.SEARCH returned an invalid total: $total" >&2; return 1; }

  if [ "$total" -eq 0 ]; then
    printf '0\n'
    return 0
  fi

  full=$("$cli" FT.SEARCH idx:ba:v2:players '@status:{active}' NOCONTENT LIMIT 0 "$total") || return 1
  full_total="${full%%$'\n'*}"
  ids=$(printf '%s\n' "$full" | tail -n +2 | LC_ALL=C sort)
  returned=$(printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' ')
  if [ "$full_total" != "$total" ] || [ "$returned" != "$total" ]; then
    echo "FT.SEARCH incomplete: total=$total, limited-total=$full_total, returned=$returned" >&2
    return 1
  fi
  printf '%s\n%s' "$total" "$ids"
}

echo "--- Kiểm tra instance restore 127.0.0.1:6381 và Redis V2 nguồn ---"
same_command "PING" PING
same_redis_version
same_command "Số người chơi" SCARD ba:v2:players
same_sorted_members "Mùa giải" SMEMBERS ba:v2:seasons
same_command "Mùa active" GET ba:v2:season:active
same_command "Số trận" SCARD ba:v2:match:ids
same_command "LLEN recent" LLEN ba:v2:matches:recent
same_command "XLEN events" XLEN ba:v2:events

# Đối chiếu chính xác toàn bộ key/value trong namespace nghiệp vụ.
# Session và bộ đếm đăng nhập sai là dữ liệu tạm có TTL, nên loại khỏi so sánh.
filter_persistent_keys() {
  awk '$0 !~ /^ba:v2:auth:(session|login:attempts):/' | LC_ALL=C sort
}
r --scan --pattern 'ba:v2:*' | filter_persistent_keys > "$WORK_DIR/restore.keys"
s --scan --pattern 'ba:v2:*' | filter_persistent_keys > "$WORK_DIR/source.keys"

if ! diff -u "$WORK_DIR/source.keys" "$WORK_DIR/restore.keys" > "$WORK_DIR/key-diff"; then
  cat "$WORK_DIR/key-diff"
  record FAIL "Tập key ba:v2: (bỏ session/counter tạm)" "khác tập key nguồn" "khớp hoàn toàn"
else
  record OK "Tập key ba:v2: (bỏ session/counter tạm)" "$(wc -l < "$WORK_DIR/restore.keys" | tr -d ' ') key" "$(wc -l < "$WORK_DIR/source.keys" | tr -d ' ') key"
fi
comm -12 "$WORK_DIR/source.keys" "$WORK_DIR/restore.keys" > "$WORK_DIR/common.keys"
while IFS= read -r key; do
  [ -n "$key" ] || continue
  restored_type=$(r TYPE "$key")
  source_type=$(s TYPE "$key")
  restored_expire=$(r PEXPIRETIME "$key")
  source_expire=$(s PEXPIRETIME "$key")
  if [ "$restored_type" != "$source_type" ]; then
    record FAIL "Value $key" "$restored_type · type differs · expireAt $restored_expire" "$source_type · expireAt $source_expire"
    continue
  fi
  if ! restored_value=$(logical_value rj "$restored_type" "$key"); then
    record FAIL "Value $key" "$restored_type · could not canonicalize restored value" "$source_type · expected supported Redis type"
    continue
  fi
  if ! source_value=$(logical_value sj "$source_type" "$key"); then
    record FAIL "Value $key" "$source_type · could not canonicalize source value" "$source_type · expected supported Redis type"
    continue
  fi
  restored_digest=$(sha256_text "$restored_value")
  source_digest=$(sha256_text "$source_value")
  if [ "$restored_value" = "$source_value" ] && [ "$restored_expire" = "$source_expire" ]; then
    record OK "Value $key" "$restored_type · logical sha256 $restored_digest · expireAt $restored_expire" "$source_type · logical sha256 $source_digest · expireAt $source_expire"
  else
    record FAIL "Value $key" "$restored_type · logical sha256 $restored_digest · expireAt $restored_expire" "$source_type · logical sha256 $source_digest · expireAt $source_expire"
    if [ "$restored_type" = "hash" ] && [ "$restored_value" != "$source_value" ]; then
      printf 'Hash field/value differences for %s:\n' "$key"
      diff -u <(printf '%s' "$source_value" | jq -r '.[] | @json') <(printf '%s' "$restored_value" | jq -r '.[] | @json') || true
    fi
  fi
done < "$WORK_DIR/common.keys"

# Redis Search index có thể không nằm trong RDB; tạo lại nếu thiếu rồi kiểm tra truy vấn thật.
if ! r FT._LIST | grep -qx 'idx:ba:v2:players'; then
  echo "[restore] Search index chưa có sau khi nạp RDB; tạo lại theo schema V2"
  r FT.CREATE idx:ba:v2:players ON HASH PREFIX 1 ba:v2:player: SCHEMA displayName TEXT country TAG level NUMERIC SORTABLE status TAG >/dev/null
  sleep 1
fi
if RESTORE_SEARCH=$(search_all_active_ids r) && SOURCE_SEARCH=$(search_all_active_ids s); then
  RESTORE_TOTAL="${RESTORE_SEARCH%%$'\n'*}"
  SOURCE_TOTAL="${SOURCE_SEARCH%%$'\n'*}"
  RESTORE_IDS=$(printf '%s\n' "$RESTORE_SEARCH" | tail -n +2 | sed '/^$/d' | tr '\n' ' ' | sed 's/ $//')
  SOURCE_IDS=$(printf '%s\n' "$SOURCE_SEARCH" | tail -n +2 | sed '/^$/d' | tr '\n' ' ' | sed 's/ $//')
  SEARCH_STATUS=OK
  [ "$RESTORE_TOTAL" = "$SOURCE_TOTAL" ] && [ "$RESTORE_IDS" = "$SOURCE_IDS" ] || SEARCH_STATUS=FAIL
  record "$SEARCH_STATUS" "FT.SEARCH active players" "$RESTORE_TOTAL players: $RESTORE_IDS" "$SOURCE_TOTAL players: $SOURCE_IDS"
else
  record FAIL "FT.SEARCH active players" "query failed or returned incomplete results" "complete count and ID list from both Redis instances"
fi

{
  echo ""
  echo "## Lần kiểm tra $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo ""
  echo "- File: \`$RDB\` (sha256 \`$(sha256sum "$RDB" | cut -d' ' -f1)\`)"
  echo "- Instance restore: \`$IMAGE\`, thư mục tạm bind mount (không dùng Docker volume), \`appendonly no\`, cổng 127.0.0.1:6381"
  echo "- Đối chiếu thực hiện với Redis V2 nguồn đang chạy; nguồn phải giữ nguyên từ lúc tạo backup đến hết kiểm tra. Session và bộ đếm đăng nhập có TTL được loại khỏi so sánh key/value. Giá trị được so theo cấu trúc Redis; hash/set/sorted set được chuẩn hóa thứ tự, list giữ nguyên thứ tự, stream so ID và toàn bộ field/value."
  echo "- Kết quả: **$PASS OK / $FAIL FAIL**"
  echo ""
  echo "| Trạng thái | Kiểm tra | Restore | Redis V2 nguồn |"
  echo "|---|---|---|---|"
  printf '%s\n' "${LINES[@]}"
} >> "$REPORT"

echo "--- $PASS OK / $FAIL FAIL · đã ghi $REPORT ---"
if [ "$KEEP" -eq 1 ]; then
  KEEP_INSTANCE=1
  echo "Giữ container $NAME tại 127.0.0.1:6381"
  echo "Thư mục dữ liệu tạm: $DATA_DIR"
  echo "Sau khi kiểm tra: docker rm -f $NAME; rm -rf -- '$WORK_DIR'"
fi
[ "$FAIL" -eq 0 ] || exit 1
