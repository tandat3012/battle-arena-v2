import { Info, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LeaderboardTable, LiveIndicator, Podium, SeasonSelect } from '../../components/arena';
import { Async, Card, EmptyState, Field, Input, PageHeader, Pagination, SeasonBadge, Segmented } from '../../components/ui';
import { qs, useApi, useLiveRefresh, type LeaderboardItem, type Season } from '../../lib/api';

interface Board {
  season: { id: string; name: string; status: Season['status']; rankedWinPoints: number } | null;
  items: LeaderboardItem[];
  total: number;
  page: number;
  pageSize: number;
  filtered: boolean;
  tieRule: string;
}

/** Trì hoãn giá trị ô tìm kiếm để không gọi API mỗi phím. */
function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Leaderboard() {
  const [params, setParams] = useSearchParams();
  const seasonId = params.get('season') ?? '';
  const [limit, setLimit] = useState<'5' | '10' | 'all'>('10');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [minScore, setMin] = useState('');
  const [maxScore, setMax] = useState('');
  const dq = useDebounced(q);
  const dMin = useDebounced(minScore);
  const dMax = useDebounced(maxScore);
  useEffect(() => setPage(1), [seasonId, limit, dq, dMin, dMax]);

  const seasons = useApi<{ items: Season[] }>('/api/public/seasons');
  const board = useApi<Board>(`/api/public/leaderboard${qs({ seasonId, limit, page: limit === 'all' ? page : undefined, q: dq, minScore: dMin, maxScore: dMax })}`);
  const live = useLiveRefresh(seasonId || board.data?.season?.id, board.reload);
  const showPodium = board.data && !board.data.filtered && board.data.page === 1;

  return (
    <>
      <PageHeader
        title="Bảng xếp hạng"
        subtitle={board.data?.season ? <span className="inline-flex flex-wrap items-center gap-2">{board.data.season.name} <SeasonBadge status={board.data.season.status} /> · Điểm thuộc riêng mùa này</span> : 'Điểm và hạng luôn thuộc một mùa cụ thể.'}
        actions={<LiveIndicator status={live} />}
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-[auto_auto_1fr_8rem_8rem] xl:items-end">
          <div className="col-span-2 xl:col-span-1"><Field label="Mùa giải" htmlFor="lb-season">
            {seasons.data ? <SeasonSelect id="lb-season" seasons={seasons.data.items} value={seasonId || board.data?.season?.id || ''} onChange={(v) => setParams(v ? { season: v } : {})} /> : <Input id="lb-season" disabled placeholder="Đang tải…" />}
          </Field></div>
          <div className="col-span-2 flex flex-col gap-1.5 xl:col-span-1">
            <span className="text-sm font-medium text-head">Hiển thị</span>
            <Segmented label="Số lượng hiển thị" value={limit} onChange={setLimit} options={[{ value: '5', label: 'Top 5' }, { value: '10', label: 'Top 10' }, { value: 'all', label: 'Tất cả' }]} />
          </div>
          <div className="col-span-2 xl:col-span-1"><Field label="Tìm theo tên" htmlFor="lb-q">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input id="lb-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="VD: Minh, Sakura…" className="pl-9" />
            </div>
          </Field></div>
          <Field label="Điểm từ" htmlFor="lb-min"><Input id="lb-min" type="number" min={0} inputMode="numeric" value={minScore} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Điểm đến" htmlFor="lb-max"><Input id="lb-max" type="number" min={0} inputMode="numeric" value={maxScore} onChange={(e) => setMax(e.target.value)} /></Field>
        </div>
        <p className="mt-3 text-xs text-muted">Tìm tên dùng Redis Search rồi giao với Sorted Set của mùa; lọc điểm dùng <code className="font-mono">ZRANGE … BYSCORE REV</code>.</p>
      </Card>

      <Async state={board} rows={8} empty={(d) => !d.items.length && <EmptyState title={d.filtered ? 'Không có người chơi khớp bộ lọc' : 'Mùa này chưa có người chơi'} hint={d.filtered ? 'Thử nới khoảng điểm hoặc đổi từ khóa.' : undefined} />}>
        {(d) => (
          <div className="flex flex-col gap-6">
            {showPodium && <Podium items={d.items.slice(0, 3)} />}
            <LeaderboardTable items={showPodium ? d.items.slice(3) : d.items} />
            {limit === 'all' && <Pagination page={d.page} total={d.total} pageSize={d.pageSize} onPage={setPage} />}
            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Hạng = <code className="font-mono">ZREVRANK + 1</code>, tính trên toàn bộ bảng của mùa kể cả khi lọc. {d.tieRule}</span>
            </p>
          </div>
        )}
      </Async>
    </>
  );
}
