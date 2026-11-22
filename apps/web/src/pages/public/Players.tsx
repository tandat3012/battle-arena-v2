import { Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Async, Avatar, Card, Country, EmptyState, Field, Input, PageHeader, Pagination, PlayerStatusBadge, Select } from '../../components/ui';
import { qs, useApi, type Paged, type PlayerListItem } from '../../lib/api';
import { COUNTRIES } from '../../lib/format';

export interface PlayerFilters {
  q: string;
  country: string;
  minLevel: string;
  maxLevel: string;
  status: string;
}

export const emptyFilters: PlayerFilters = { q: '', country: '', minLevel: '', maxLevel: '', status: '' };

export function usePlayerSearch(filters: PlayerFilters, base: string, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 300);
    return () => clearTimeout(t);
  }, [filters]);
  useEffect(() => setPage(1), [debounced]);
  const state = useApi<Paged<PlayerListItem> & { query: string }>(`${base}${qs({ ...debounced, page, pageSize })}`);
  return { ...state, page, setPage };
}

/** Bộ lọc dùng chung cho trang Players công khai và Admin Players — tất cả đi qua FT.SEARCH. */
export function PlayerFilterBar({ value, onChange, query, extra }: { value: PlayerFilters; onChange: (f: PlayerFilters) => void; query?: string; extra?: ReactNode }) {
  const set = (k: keyof PlayerFilters) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <Card className="mb-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-[1fr_11rem_7rem_7rem_10rem_auto] lg:items-end">
        <div className="col-span-2 lg:col-span-1">
          <Field label="Tên người chơi" htmlFor="pf-q">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input id="pf-q" value={value.q} onChange={set('q')} placeholder="Gõ tên, VD: nguyễn, kim…" className="pl-9" />
            </div>
          </Field>
        </div>
        <Field label="Quốc gia" htmlFor="pf-country">
          <Select id="pf-country" value={value.country} onChange={set('country')}>
            <option value="">Tất cả</option>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
          </Select>
        </Field>
        <Field label="Level từ" htmlFor="pf-min"><Input id="pf-min" type="number" min={1} max={100} value={value.minLevel} onChange={set('minLevel')} /></Field>
        <Field label="Level đến" htmlFor="pf-max"><Input id="pf-max" type="number" min={1} max={100} value={value.maxLevel} onChange={set('maxLevel')} /></Field>
        <Field label="Trạng thái" htmlFor="pf-status">
          <Select id="pf-status" value={value.status} onChange={set('status')}>
            <option value="">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </Select>
        </Field>
        {extra && <div className="col-span-2 lg:col-span-1">{extra}</div>}
      </div>
      {query && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <SlidersHorizontal className="size-3.5" aria-hidden /> Redis Search:
          <code className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-body break-all">FT.SEARCH idx:ba:v2:players '{query}'</code>
        </p>
      )}
    </Card>
  );
}

export default function Players() {
  const [filters, setFilters] = useState(emptyFilters);
  const list = usePlayerSearch(filters, '/api/public/players', 24);
  return (
    <>
      <PageHeader title="Người chơi" subtitle="Tìm theo tên, quốc gia, level, trạng thái — sắp theo level giảm dần." />
      <PlayerFilterBar value={filters} onChange={setFilters} query={list.data?.query} />
      <Async state={list} rows={6} empty={(d) => !d.items.length && <EmptyState title="Không tìm thấy người chơi" hint="Tìm tên theo tiền tố từng từ; tên có dấu cần gõ đúng dấu (phụ thuộc tokenizer của Redis Search)." />}>
        {(d) => (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {d.items.map((p) => (
                <li key={p.id}>
                  <Link to={`/players/${p.id}`} className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-surface-3 hover:bg-surface-2">
                    <div className="flex items-center gap-3">
                      <Avatar id={p.id} name={p.displayName} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-head">{p.displayName}</p>
                        <p className="font-mono text-xs text-muted">{p.id}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                      <Country code={p.country} />
                      <span className="tabular rounded-md border border-line bg-surface-2 px-1.5 text-xs font-semibold text-head">Lv {p.level}</span>
                      <span className="tabular"><span className="font-semibold text-friendly">{p.totalWins}</span> thắng · <span className="font-semibold text-secondary">{p.totalLosses}</span> thua</span>
                      <PlayerStatusBadge status={p.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={list.page} total={d.total} pageSize={d.pageSize} onPage={list.setPage} />
          </>
        )}
      </Async>
    </>
  );
}
