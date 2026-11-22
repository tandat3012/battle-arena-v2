import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MatchCard, MatchDetail, SeasonSelect } from '../../components/arena';
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Select } from '../../components/ui';
import { api, qs, useApi, type ApiError, type Match, type Season } from '../../lib/api';

interface MatchPage {
  items: Match[];
  total: number | null;
  nextCursor: string | null;
  source: string;
}

const SOURCE_LABEL: Record<string, string> = {
  'recent-list': 'List ba:v2:matches:recent',
  'season-index': 'Sorted Set ba:v2:season:<id>:matches',
  'player-index': 'Sorted Set ba:v2:player:<id>:matches',
};

/** Lịch sử trận có cursor pagination ("Tải thêm"). Dùng cho cả trang công khai và Admin. */
export function useMatchHistory(base: string, filters: { seasonId: string; mode: string; playerId: string }) {
  const [items, setItems] = useState<Match[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total: number | null; source: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(filters);

  const load = async (from: string | null, replace: boolean) => {
    setLoading(true);
    try {
      const d = await api<MatchPage>(`${base}${qs({ ...filters, cursor: from, limit: 12 })}`);
      setItems((old) => (replace ? d.items : [...old, ...d.items]));
      setCursor(d.nextCursor);
      setMeta({ total: d.total, source: d.source });
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(null, true), [key, tick]);
  return { items, cursor, meta, loading, error, loadMore: () => load(cursor, false), reload: () => setTick((t) => t + 1) };
}

export default function History() {
  const [params, setParams] = useSearchParams();
  const seasons = useApi<{ items: Season[]; activeSeasonId: string | null }>('/api/public/seasons');
  const [mode, setMode] = useState('');
  const [playerInput, setPlayerInput] = useState(params.get('player') ?? '');
  const playerId = params.get('player') ?? '';
  const seasonId = params.get('season') ?? '';
  const h = useMatchHistory('/api/public/matches', { seasonId, mode, playerId });
  const [open, setOpen] = useState<Match | null>(null);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  };

  return (
    <>
      <PageHeader title="Lịch sử trận đấu" subtitle="Mới nhất trước. Trận đã ghi là bất biến, vẫn giữ khi người chơi bị vô hiệu hóa hoặc mùa đã đóng." />
      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[auto_12rem_1fr] lg:items-start" onSubmit={(e) => { e.preventDefault(); setParam('player', playerInput.trim()); }}>
          <Field label="Mùa giải" htmlFor="h-season">
            {seasons.data ? <SeasonSelect id="h-season" seasons={seasons.data.items} value={seasonId} onChange={(v) => setParam('season', v)} allowRecent /> : <Input id="h-season" disabled placeholder="Đang tải…" />}
          </Field>
          <Field label="Chế độ" htmlFor="h-mode">
            <Select id="h-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="ranked_1v1">Ranked</option>
              <option value="friendly_1v1">Friendly</option>
            </Select>
          </Field>
          <Field label="Mã người chơi" htmlFor="h-player" hint="VD: player01 — Enter để lọc">
            <div className="flex gap-2">
              <Input id="h-player" value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} placeholder="player01" />
              <Button type="submit" variant="subtle">Lọc</Button>
              {playerId && <Button type="button" variant="ghost" onClick={() => { setPlayerInput(''); setParam('player', ''); }}>Bỏ</Button>}
            </div>
          </Field>
        </form>
        {h.meta && <p className="mt-4 text-xs text-muted">Nguồn: <code className="font-mono text-body">{SOURCE_LABEL[h.meta.source]}</code>{h.meta.total != null && ` · ${h.meta.total} trận`}</p>}
      </Card>

      {h.error && !h.items.length ? (
        <ErrorState error={h.error} onRetry={h.reload} />
      ) : h.loading && !h.items.length ? (
        <LoadingBlock rows={5} />
      ) : !h.items.length ? (
        <EmptyState title="Không có trận phù hợp" hint="Đổi mùa, chế độ hoặc mã người chơi." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {h.items.map((m) => <MatchCard key={m.id} m={m} onOpen={setOpen} />)}
          </div>
          {h.cursor && (
            <div className="mt-6 flex justify-center">
              <Button variant="ghost" loading={h.loading} onClick={h.loadMore}>Tải thêm</Button>
            </div>
          )}
        </>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Chi tiết trận đấu" wide>
        {open && <MatchDetailLoader id={open.id} fallback={open} />}
      </Modal>
    </>
  );
}

function MatchDetailLoader({ id, fallback }: { id: string; fallback: Match }) {
  const d = useApi<Match>(`/api/public/matches/${id}`);
  return <MatchDetail m={d.data ?? fallback} />;
}
