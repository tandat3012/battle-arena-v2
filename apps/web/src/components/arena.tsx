import { Crown, Radio, WifiOff } from 'lucide-react';
import { Link } from 'react-router';
import type { LeaderboardItem, LiveStatus, Match, Season } from '../lib/api';
import { fmtDateTime, fmtNum } from '../lib/format';
import { Avatar, Badge, Country, cx, ModeBadge, PlayerStatusBadge, Select } from './ui';

export function LiveIndicator({ status }: { status: LiveStatus }) {
  if (status === 'live')
    return (
      <Badge className="border-friendly/70 py-1 text-friendly">
        <Radio className="size-3.5" aria-hidden /> Realtime (SSE)
      </Badge>
    );
  return (
    <Badge className="border-line bg-surface-2 py-1 text-body">
      <WifiOff className="size-3.5" aria-hidden /> {status === 'connecting' ? 'Đang kết nối realtime…' : 'Mất realtime — dữ liệu tải khi vào lại'}
    </Badge>
  );
}

export function SeasonSelect({ seasons, value, onChange, id = 'season', allowRecent }: { seasons: Season[]; value: string; onChange: (v: string) => void; id?: string; allowRecent?: boolean }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Chọn mùa giải" className="sm:w-72">
      {allowRecent && <option value="">Gần đây (mọi mùa)</option>}
      {seasons.filter((s) => s.status !== 'draft').map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} {s.status === 'active' ? '· đang diễn ra' : '· đã đóng'}
        </option>
      ))}
    </Select>
  );
}

const MEDAL = {
  1: { text: 'text-gold', bg: 'bg-gold', card: 'border-gold/60 shadow-[0_18px_50px_-24px_rgb(255_209_102/0.45)]' },
  2: { text: 'text-silver', bg: 'bg-silver', card: 'border-line' },
  3: { text: 'text-bronze', bg: 'bg-bronze', card: 'border-line' },
} as const;
const medal = (rank: number) => MEDAL[rank as 1 | 2 | 3];

/** Huy hiệu hạng: Top 3 là vòng tròn màu đặc, còn lại là số. */
export function RankMark({ rank }: { rank: number }) {
  const m = medal(rank);
  if (!m) return <span className="tabular font-display text-lg font-bold text-body">#{String(rank).padStart(2, '0')}</span>;
  return (
    <span className={cx('tabular grid size-9 place-items-center rounded-full font-display text-base font-bold text-accent-ink', m.bg)} aria-label={`Hạng ${rank}`}>
      {rank}
    </span>
  );
}

/** Bục Top 3 (tham khảo ảnh 1): hạng 1 ở giữa và cao hơn. Màu chỉ ở viền trên + số, nền giữ trung tính. */
export function Podium({ items }: { items: LeaderboardItem[] }) {
  if (!items.length) return null;
  const order = { 1: 'sm:order-2', 2: 'sm:order-1 sm:mt-10', 3: 'sm:order-3 sm:mt-14' } as const;
  return (
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start" aria-label="Top 3">
      {items.slice(0, 3).map((p) => {
        const m = medal(p.rank) ?? MEDAL[3];
        return (
          <li key={p.playerId} className={order[p.rank as 1 | 2 | 3] ?? ''}>
            <Link
              to={`/players/${p.playerId}`}
              className={cx('group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border bg-surface px-5 pt-7 pb-6 text-center transition-colors duration-200 hover:bg-surface-2', m.card, p.rank === 1 && 'sm:pt-9 sm:pb-8')}
            >
              <span className={cx('absolute inset-x-0 top-0 h-1', m.bg)} aria-hidden />
              <div className="flex items-center gap-2">
                {p.rank === 1 && <Crown className="size-5 text-gold" aria-hidden />}
                <span className={cx('font-display text-sm font-bold tracking-[0.2em] uppercase', m.text)}>Hạng {p.rank}</span>
              </div>
              <Avatar id={p.playerId} name={p.displayName} size={p.rank === 1 ? 'xl' : 'lg'} />
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-head group-hover:text-accent">{p.displayName}</p>
                <div className="mt-1 flex items-center justify-center gap-2"><Country code={p.country} /><PlayerStatusBadge status={p.status} /></div>
              </div>
              <p className={cx('tabular font-display text-4xl font-bold', m.text)}>
                {fmtNum(p.score)}<span className="ml-1.5 font-sans text-sm font-medium text-body">điểm</span>
              </p>
              <p className="text-sm text-body">
                <span className="font-semibold text-head">{p.rankedWins}</span> thắng · <span className="font-semibold text-head">{p.rankedLosses}</span> thua Ranked
              </p>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function WinRate({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-muted">Chưa đấu</span>;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-3" role="presentation">
        <div className="h-full rounded-full bg-friendly" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular w-12 text-sm text-head">{value}%</span>
    </div>
  );
}

/** Bảng xếp hạng dạng hàng bo góc (ảnh 1). Cuộn ngang trên mobile. */
export function LeaderboardTable({ items }: { items: LeaderboardItem[] }) {
  const th = 'px-4 pb-1 font-semibold';
  return (
    <>
    {/* Mobile: danh sách gọn để luôn thấy điểm, không phải cuộn ngang */}
    <ul className="flex flex-col gap-2 sm:hidden">
      {items.map((p) => (
        <li key={p.playerId}>
          <Link to={`/players/${p.playerId}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-3 active:bg-surface-2">
            <span className="flex w-10 shrink-0 justify-center"><RankMark rank={p.rank} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><span className="truncate font-semibold text-head">{p.displayName}</span><PlayerStatusBadge status={p.status} /></span>
              <span className="mt-0.5 flex items-center gap-2 text-xs"><Country code={p.country} /><span className="text-friendly">{p.rankedWins} thắng</span><span className="text-secondary">{p.rankedLosses} thua</span></span>
            </span>
            <span className="tabular shrink-0 font-display text-xl font-bold text-head">{fmtNum(p.score)}</span>
          </Link>
        </li>
      ))}
    </ul>
    <div className="relative -mx-1 hidden overflow-x-auto px-1 sm:block">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs tracking-wider text-muted uppercase">
            <th scope="col" className={th}>Hạng</th>
            <th scope="col" className={th}>Người chơi</th>
            <th scope="col" className={th}>Level</th>
            <th scope="col" className={cx(th, 'text-center')}>Thắng</th>
            <th scope="col" className={cx(th, 'text-center')}>Thua</th>
            <th scope="col" className={th}>Tỉ lệ thắng</th>
            <th scope="col" className={cx(th, 'text-right')}>Điểm</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.playerId} className="bg-surface transition-colors hover:bg-surface-2 [&>td]:border-y [&>td]:border-line [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r">
              <td className="w-20 px-4 py-3.5"><RankMark rank={p.rank} /></td>
              <td className="px-4 py-3.5">
                <Link to={`/players/${p.playerId}`} className="group flex items-center gap-3">
                  <Avatar id={p.playerId} name={p.displayName} size="md" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-head group-hover:text-accent">{p.displayName}</span>
                      <PlayerStatusBadge status={p.status} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-sm"><Country code={p.country} /><span className="font-mono text-xs text-muted">{p.playerId}</span></span>
                  </span>
                </Link>
              </td>
              <td className="tabular px-4 py-3.5 text-head">Lv {p.level}</td>
              <td className="tabular px-4 py-3.5 text-center font-semibold text-friendly">{p.rankedWins}</td>
              <td className="tabular px-4 py-3.5 text-center font-semibold text-secondary">{p.rankedLosses}</td>
              <td className="px-4 py-3.5"><WinRate value={p.winRate} /></td>
              <td className="tabular px-4 py-3.5 text-right font-display text-xl font-bold text-head">{fmtNum(p.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

/** Thẻ trận: 2 hàng người chơi xếp dọc, hàng thắng nổi bật — không còn khoảng trống giữa, kết quả đọc được ngay. */
export function MatchCard({ m, onOpen }: { m: Match; onOpen?: (m: Match) => void }) {
  const row = (p: Match['player1']) => {
    const won = p.id === m.winnerId;
    return (
      <div className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5', won && 'bg-surface-2')}>
        <Avatar id={p.id} name={p.displayName} size="sm" />
        <p className={cx('min-w-0 flex-1 truncate', won ? 'font-semibold text-head' : 'text-body')} title={p.displayName}>{p.displayName}</p>
        {won ? (
          <span className="flex shrink-0 items-center gap-2">
            {m.mode === 'ranked_1v1' && <span className="tabular font-display text-base font-bold text-accent">+{m.pointsAwarded}</span>}
            <span className="rounded-md border border-friendly/70 px-2 py-0.5 text-xs font-semibold text-friendly">Thắng</span>
          </span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 text-xs text-muted">Thua</span>
        )}
      </div>
    );
  };
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><ModeBadge mode={m.mode} /><span className="font-mono text-xs text-muted">{m.seasonId}</span></span>
        <span className="text-xs text-muted">{fmtDateTime(m.recordedAt)}</span>
      </div>
      <div className="flex flex-col gap-1">
        {row(m.player1)}
        <div className="flex items-center gap-3 px-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="font-display text-[11px] font-bold tracking-[0.3em] text-muted">VS</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        {row(m.player2)}
      </div>
      {m.mode === 'friendly_1v1' && <p className="px-1 text-xs text-muted">Giao hữu — không đổi điểm xếp hạng</p>}
    </>
  );
  const cls = 'flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-surface-3';
  return onOpen ? (
    <button type="button" onClick={() => onOpen(m)} className={cls} aria-label={`Xem chi tiết trận ${m.player1.displayName} và ${m.player2.displayName}`}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function MatchDetail({ m }: { m: Match }) {
  const winner = m.winnerId === m.player1.id ? m.player1 : m.player2;
  const loser = m.winnerId === m.player1.id ? m.player2 : m.player1;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-body">{label}</dt>
      <dd className="text-right text-head">{value}</dd>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <MatchCard m={m} />
      <dl className="text-sm">
        {row('Mã trận (matchId)', <span className="font-mono text-xs break-all">{m.id}</span>)}
        {row('Mùa giải', <span className="font-mono">{m.seasonId}</span>)}
        {row('Chế độ', <ModeBadge mode={m.mode} />)}
        {row('Người thắng', <Link className="hover:text-accent" to={`/players/${winner.id}`}>{winner.displayName}</Link>)}
        {row('Người thua', <Link className="hover:text-accent" to={`/players/${loser.id}`}>{loser.displayName}</Link>)}
        {row('Điểm thưởng', `${m.pointsAwarded}`)}
        {m.mode === 'ranked_1v1' && row('Điểm người thắng', `${fmtNum(m.winnerScoreBefore)} → ${fmtNum(m.winnerScoreAfter)}`)}
        {m.mode === 'ranked_1v1' && row('Hạng người thắng', `${m.winnerRankBefore ?? '—'} → ${m.winnerRankAfter ?? '—'}`)}
        {row('Thời điểm ghi', fmtDateTime(m.recordedAt))}
        {m.createdBy && row('Ghi bởi', m.createdBy)}
      </dl>
    </div>
  );
}
