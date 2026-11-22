import { ArrowLeft, Clock } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { MatchCard } from '../../components/arena';
import { Async, Avatar, Card, Country, cx, EmptyState, PageHeader, PlayerStatusBadge, SeasonBadge, SectionTitle } from '../../components/ui';
import { useApi, type Match, type SeasonStatus } from '../../lib/api';
import { fmtDate, fmtDateTime, fmtNum } from '../../lib/format';

interface Profile {
  id: string;
  displayName: string;
  country: string;
  level: number;
  status: 'active' | 'inactive';
  totalWins: number;
  totalLosses: number;
  createdAt: string;
  lastSeen: string | null;
  selectedSeasonId: string | null;
  seasonStats: {
    seasonId: string;
    seasonName: string;
    seasonStatus: SeasonStatus;
    score: number | null;
    rank: number | null;
    rankedWins: number;
    rankedLosses: number;
    friendlyWins: number;
    friendlyLosses: number;
  }[];
  recentMatches: Match[];
}

export default function PlayerDetail() {
  const { id = '' } = useParams();
  const profile = useApi<Profile>(`/api/public/players/${encodeURIComponent(id)}`);
  const [tab, setTab] = useState<string | null>(null);

  return (
    <>
      <Link to="/players" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm text-body hover:text-head"><ArrowLeft className="size-4" aria-hidden /> Danh sách người chơi</Link>
      <Async state={profile} rows={5}>
        {(p) => {
          const current = p.seasonStats.find((s) => s.seasonId === (tab ?? p.selectedSeasonId)) ?? p.seasonStats[0];
          return (
            <div className="flex flex-col gap-6">
              <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar id={p.id} name={p.displayName} size="xl" />
                <div className="min-w-0 flex-1">
                  <PageHeader title={p.displayName} subtitle={<span className="flex flex-wrap items-center gap-3"><span className="font-mono">{p.id}</span><Country code={p.country} /><span className="text-head">Level {p.level}</span><PlayerStatusBadge status={p.status} /></span>} />
                  <div className="-mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span>Tổng: <strong className="text-friendly">{p.totalWins} thắng</strong> · <strong className="text-secondary">{p.totalLosses} thua</strong></span>
                    <span>Tham gia: {fmtDate(p.createdAt)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="size-4" aria-hidden /> Hoạt động mô phỏng gần nhất: {fmtDateTime(p.lastSeen)}</span>
                  </div>
                </div>
              </Card>

              <section>
                <SectionTitle>Thành tích theo mùa</SectionTitle>
                {p.seasonStats.length ? (
                  <>
                    <div role="tablist" aria-label="Chọn mùa" className="mb-4 flex flex-wrap gap-2">
                      {p.seasonStats.map((s) => (
                        <button key={s.seasonId} role="tab" aria-selected={s.seasonId === current.seasonId} onClick={() => setTab(s.seasonId)}
                          className={cx('min-h-10 rounded-xl border px-4 text-sm transition-colors', s.seasonId === current.seasonId ? 'border-accent bg-surface-2 font-semibold text-accent' : 'border-line text-body hover:text-head')}>
                          {s.seasonName}
                        </button>
                      ))}
                    </div>
                    <Card className="grid grid-cols-2 gap-4 md:grid-cols-5">
                      <div className="col-span-2 flex items-center gap-2 md:col-span-5"><SeasonBadge status={current.seasonStatus} /><span className="font-mono text-xs text-muted">{current.seasonId}</span></div>
                      <Stat label="Hạng" value={current.rank ? `#${current.rank}` : 'Chưa xếp hạng'} accent />
                      <Stat label="Điểm Ranked" value={fmtNum(current.score)} accent />
                      <Stat label="Ranked thắng/thua" value={`${current.rankedWins} / ${current.rankedLosses}`} />
                      <Stat label="Friendly thắng/thua" value={`${current.friendlyWins} / ${current.friendlyLosses}`} />
                      <Stat label="Tỉ lệ thắng Ranked" value={current.rankedWins + current.rankedLosses ? `${Math.round((current.rankedWins / (current.rankedWins + current.rankedLosses)) * 100)}%` : '—'} />
                    </Card>
                  </>
                ) : (
                  <EmptyState title="Chưa tham gia mùa nào" />
                )}
              </section>

              <section>
                <SectionTitle aside={<Link to={`/history?player=${p.id}`} className="text-sm text-accent hover:underline">Toàn bộ lịch sử</Link>}>Trận gần đây</SectionTitle>
                {p.recentMatches.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{p.recentMatches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
                ) : (
                  <EmptyState title="Chưa có trận nào" />
                )}
              </section>
            </div>
          );
        }}
      </Async>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-body">{label}</p>
      <p className={cx('tabular mt-1 font-display text-xl font-bold', accent ? 'text-accent' : 'text-head')}>{value}</p>
    </div>
  );
}
