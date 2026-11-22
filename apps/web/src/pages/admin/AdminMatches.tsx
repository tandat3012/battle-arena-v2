import { ArrowRight, Lock, RefreshCw, Repeat, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MatchCard, MatchDetail } from '../../components/arena';
import { Async, Badge, Button, Card, cx, EmptyState, Field, Modal, PageHeader, SectionTitle, Segmented, Select, useToast } from '../../components/ui';
import { api, ApiError, useApi, type Match, type Mode, type Paged, type PlayerListItem, type Season } from '../../lib/api';
import { fmtNum } from '../../lib/format';
import { useMatchHistory } from '../public/History';

interface RecordResult {
  match: Match;
  alreadyProcessed: boolean;
  winnerBefore: { score: number; rank: number | null };
  winnerAfter: { score: number; rank: number | null };
  loserCurrent: { score: number | null; rank: number | null };
}

interface Game { status: 'active' | 'maintenance'; modes: Record<Mode, boolean> }

export default function AdminMatches() {
  const seasons = useApi<{ items: Season[]; activeSeasonId: string | null }>('/api/admin/seasons');
  const game = useApi<Game>('/api/admin/game');
  const players = useApi<Paged<PlayerListItem>>('/api/admin/players?status=active&pageSize=100');
  const history = useMatchHistory('/api/admin/matches', { seasonId: '', mode: '', playerId: '' });
  const toast = useToast();

  const active = seasons.data?.items.find((s) => s.id === seasons.data?.activeSeasonId) ?? null;
  // matchId sinh 1 lần cho mỗi trận, giữ nguyên khi retry → server chống ghi trùng (idempotency key)
  const [matchId, setMatchId] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<Mode>('ranked_1v1');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [winner, setWinner] = useState<'1' | '2' | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [lastPayload, setLastPayload] = useState<object | null>(null);
  const [open, setOpen] = useState<Match | null>(null);

  const sortedPlayers = useMemo(() => [...(players.data?.items ?? [])].sort((a, b) => a.id.localeCompare(b.id)), [players.data]);
  const name = (id: string) => sortedPlayers.find((p) => p.id === id)?.displayName ?? id;
  const locked = !active || game.data?.status === 'maintenance';
  const points = mode === 'ranked_1v1' ? (active?.rankedWinPoints ?? 0) : 0;
  const valid = p1 && p2 && p1 !== p2 && winner && !locked && game.data?.modes[mode];

  const send = async (payload: object) => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<RecordResult>('/api/admin/matches', { method: 'POST', body: payload });
      setResult(r);
      setLastPayload(payload);
      toast('success', r.alreadyProcessed ? 'Trận này đã được ghi trước đó — không cộng điểm lần 2' : 'Đã ghi nhận trận đấu');
      history.reload();
      seasons.reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !active) return;
    void send({ matchId, seasonId: active.id, mode, player1Id: p1, player2Id: p2, winnerId: winner === '1' ? p1 : p2 });
  };

  const newMatch = () => {
    setMatchId(crypto.randomUUID());
    setResult(null);
    setLastPayload(null);
    setError(null);
    setWinner('');
  };

  return (
    <>
      <PageHeader title="Quản lý trận đấu" subtitle="Ghi nhận kết quả 1v1 vào mùa active. Điểm do server quyết định; mỗi matchId chỉ ghi thành công một lần." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <SectionTitle aside={active ? <Badge className="border-friendly/70 text-friendly">{active.name}</Badge> : null}>Ghi nhận trận mới</SectionTitle>
          {seasons.loading || game.loading || players.loading ? (
            <p className="text-sm" role="status">Đang tải dữ liệu…</p>
          ) : locked ? (
            <div className="flex items-start gap-3 rounded-xl border border-tertiary/60 bg-surface-2 p-4 text-sm">
              <Lock className="mt-0.5 size-5 shrink-0 text-tertiary" aria-hidden />
              <p>{!active ? <>Không có mùa giải active — form ghi trận bị khóa. Kích hoạt một mùa tại <Link className="text-accent underline" to="/admin/game">Game &amp; Mùa giải</Link>.</> : 'Game đang ở chế độ bảo trì — không ghi trận mới.'}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-head">Chế độ</span>
                <Segmented label="Chế độ đấu" value={mode} onChange={setMode} options={[
                  { value: 'ranked_1v1', label: `Ranked${game.data?.modes.ranked_1v1 ? '' : ' (tắt)'}`, disabled: !game.data?.modes.ranked_1v1 },
                  { value: 'friendly_1v1', label: `Friendly${game.data?.modes.friendly_1v1 ? '' : ' (tắt)'}`, disabled: !game.data?.modes.friendly_1v1 },
                ]} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([['Người chơi 1', p1, setP1, p2], ['Người chơi 2', p2, setP2, p1]] as const).map(([label, val, setVal, other], i) => (
                  <Field key={label} label={label} htmlFor={`mp-${i}`}>
                    <Select id={`mp-${i}`} value={val} onChange={(e) => { setVal(e.target.value); setWinner(''); }}>
                      <option value="">— Chọn người chơi active —</option>
                      {sortedPlayers.map((p) => <option key={p.id} value={p.id} disabled={p.id === other}>{p.id} · {p.displayName}</option>)}
                    </Select>
                  </Field>
                ))}
              </div>
              <fieldset className="flex flex-col gap-2" disabled={!p1 || !p2 || p1 === p2}>
                <legend className="mb-1.5 text-sm font-medium text-head">Người thắng</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(['1', '2'] as const).map((w) => {
                    const id = w === '1' ? p1 : p2;
                    return (
                      <label key={w} className={cx('flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm transition-colors has-disabled:opacity-50', winner === w ? 'border-accent bg-surface-2 font-semibold text-head' : 'border-line hover:border-surface-3')}>
                        <input type="radio" name="winner" value={w} checked={winner === w} onChange={() => setWinner(w)} className="accent-[#ff8906]" />
                        <span className="truncate">{id ? name(id) : `Người chơi ${w}`}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="rounded-xl border border-line bg-bg p-3 text-sm">
                <p>Điểm dự kiến cho người thắng: <strong className={mode === 'ranked_1v1' ? 'text-accent' : 'text-friendly'}>{mode === 'ranked_1v1' ? `+${points}` : '0 (Friendly không đổi điểm)'}</strong></p>
                <p className="mt-1 text-xs text-muted">Mã trận: <code className="font-mono break-all text-body">{matchId}</code></p>
              </div>
              {error && <p role="alert" className="rounded-xl border border-secondary/60 bg-surface-2 px-3 py-2 text-sm text-head">{error.message} <span className="font-mono text-xs text-body">({error.code})</span></p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={submitting} disabled={!valid || Boolean(result)}><Send className="size-4" aria-hidden />Ghi nhận kết quả</Button>
                {result && <Button type="button" variant="ghost" onClick={newMatch}><RefreshCw className="size-4" aria-hidden />Trận mới</Button>}
              </div>
            </form>
          )}
        </Card>

        <Card>
          <SectionTitle>Kết quả xử lý</SectionTitle>
          {!result ? (
            <EmptyState title="Chưa ghi trận nào trong phiên này" hint="Kết quả trước/sau (điểm, hạng) sẽ hiển thị tại đây." />
          ) : (
            <div className="flex flex-col gap-4">
              <Badge className={result.alreadyProcessed ? 'border-gold/70 py-1 text-gold' : 'border-friendly/70 py-1 text-friendly'}>
                {result.alreadyProcessed ? 'alreadyProcessed: true — trận đã tồn tại, không ghi lại' : 'Đã commit nguyên tử bằng Lua'}
              </Badge>
              <MatchCard m={result.match} />
              {result.match.mode === 'ranked_1v1' ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-line bg-bg p-3">
                    <p className="text-xs text-body">Điểm người thắng</p>
                    <p className="tabular mt-1 flex items-center gap-2 font-display text-lg font-bold text-head">{fmtNum(result.winnerBefore.score)} <ArrowRight className="size-4 text-muted" aria-hidden /> <span className="text-accent">{fmtNum(result.winnerAfter.score)}</span></p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg p-3">
                    <p className="text-xs text-body">Hạng người thắng</p>
                    <p className="tabular mt-1 flex items-center gap-2 font-display text-lg font-bold text-head">#{result.winnerBefore.rank ?? '—'} <ArrowRight className="size-4 text-muted" aria-hidden /> <span className="text-accent">#{result.winnerAfter.rank ?? '—'}</span></p>
                  </div>
                  <p className="col-span-2 text-xs text-muted">Người thua: điểm giữ nguyên {fmtNum(result.loserCurrent.score)} (hạng hiện tại #{result.loserCurrent.rank ?? '—'}).</p>
                </div>
              ) : (
                <p className="text-sm">Friendly: thắng/thua và lịch sử được cập nhật, <strong className="text-head">điểm Sorted Set không đổi</strong>.</p>
              )}
              {lastPayload && (
                <div className="rounded-xl border border-dashed border-line p-3 text-sm">
                  <p className="mb-2">Minh họa chống trùng: gửi lại <strong className="text-head">đúng payload và matchId</strong> — server trả bản ghi cũ, điểm không tăng.</p>
                  <Button variant="subtle" loading={submitting} onClick={() => send(lastPayload)}><Repeat className="size-4" aria-hidden />Gửi lại cùng matchId</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <SectionTitle>Trận gần đây (mọi mùa)</SectionTitle>
        <Async state={{ data: history.items.length || !history.loading ? history.items : null, error: history.error, loading: history.loading, reload: history.reload }} empty={(d) => !d.length && <EmptyState title="Chưa có trận nào" />}>
          {(items) => (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((m) => <MatchCard key={m.id} m={m} onOpen={setOpen} />)}</div>
              {history.cursor && <div className="mt-6 flex justify-center"><Button variant="ghost" loading={history.loading} onClick={history.loadMore}>Tải thêm</Button></div>}
            </>
          )}
        </Async>
      </section>

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Chi tiết trận đấu" wide>
        {open && <MatchDetail m={open} />}
      </Modal>
    </>
  );
}
