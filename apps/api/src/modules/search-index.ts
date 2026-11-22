import { SCHEMA_FIELD_TYPE } from 'redis';
import { k, NS } from '../keys.js';
import { redis } from '../redis.js';

/** Tạo Redis Search index nếu chưa có (kiểm tra FT._LIST trước). SRS 5.4. */
export async function ensurePlayerIndex() {
  const list = await redis.ft._list();
  if (list.includes(k.playerIndex)) return false;
  await redis.ft.create(
    k.playerIndex,
    {
      displayName: SCHEMA_FIELD_TYPE.TEXT,
      country: SCHEMA_FIELD_TYPE.TAG,
      level: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
      status: SCHEMA_FIELD_TYPE.TAG,
    },
    { ON: 'HASH', PREFIX: `${NS}player:` },
  );
  return true;
}

// Ký tự đặc biệt trong cú pháp query Redis Search phải escape bằng "\".
const escapeQuery = (s: string) => s.replace(/[,.<>{}[\]"':;!@#$%^&*()\-+=~|/\\]/g, '\\$&');

export interface PlayerFilter {
  q?: string;
  country?: string;
  minLevel?: number;
  maxLevel?: number;
  status?: 'active' | 'inactive';
}

/** Dựng query FT.SEARCH từ bộ lọc đã validate. Tên: mỗi từ khớp tiền tố (từ ≥2 ký tự). */
export function buildPlayerQuery(f: PlayerFilter) {
  const parts: string[] = [];
  const words = (f.q ?? '').trim().split(/\s+/).filter(Boolean).map(escapeQuery);
  if (words.length) parts.push(`@displayName:(${words.map((w) => (w.length >= 2 ? `${w}*` : w)).join(' ')})`);
  if (f.country) parts.push(`@country:{${f.country}}`);
  if (f.minLevel != null || f.maxLevel != null) parts.push(`@level:[${f.minLevel ?? '-inf'} ${f.maxLevel ?? '+inf'}]`);
  if (f.status) parts.push(`@status:{${f.status}}`);
  return parts.length ? parts.join(' ') : '*';
}

export async function searchPlayerIds(query: string, offset: number, size: number) {
  const res = await redis.ft.search(k.playerIndex, query, {
    LIMIT: { from: offset, size },
    SORTBY: { BY: 'level', DIRECTION: 'DESC' },
    RETURN: [],
    DIALECT: 2,
  });
  return { total: res.total, ids: res.documents.map((d) => d.id.slice(`${NS}player:`.length)) };
}
