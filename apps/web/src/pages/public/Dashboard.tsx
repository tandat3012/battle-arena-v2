import { ArrowRight, Gamepad2, Swords, Trophy, Users, Wifi } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LiveIndicator, MatchCard, Podium, SeasonSelect } from '../../components/arena';
import { Async, Card, EmptyState, PageHeader, SeasonBadge, SectionTitle, StatCard } from '../../components/ui';
import { qs, useApi, useLiveRefresh, type LeaderboardItem, type Match, type Season } from '../../lib/api';
import { fmtNum } from '../../lib/format';

interface DashboardData {
  totalPlayers: number;
  totalMatches: number;
  simulatedOnlineCount: number;
  selectedSeason: { id: string; name: string; status: Season['status']; rankedWinPoints: number } | null;
  top3: LeaderboardItem[];
  recentMatches: Match[];
}

export default function Dashboard() {
  const [seasonId, setSeasonId] = useState('');
  const seasons = useApi<{ items: Season[]; activeSeasonId: string | null }>('/api/public/seasons');
  const dash = useApi<DashboardData>(`/api/public/dashboard${qs({ seasonId })}`);
  const live = useLiveRefresh(seasonId || dash.data?.selectedSeason?.id, () => {
    dash.reload();
    seasons.reload();
  });
  const selected = seasonId || dash.data?.selectedSeason?.id || '';

  return (
    <>
      <PageHeader
        title="Tổng quan đấu trường"
        subtitle="Bảng xếp hạng 1v1 nhiều mùa giải — mọi số liệu lấy trực tiếp từ Redis."
        actions={<>
          <LiveIndicator status={live} />
          {seasons.data && <SeasonSelect seasons={seasons.data.items} value={selected} onChange={setSeasonId} id="dash-season" />}
        </>}
      />
      <Async state={dash} rows={6}>
        {(d) => (
          <div className="flex flex-col gap-12">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Tổng hồ sơ người chơi" value={fmtNum(d.totalPlayers)} icon={<Users className="size-5" />} hint="Gồm cả người đã vô hiệu hóa (SCARD)" />
              <StatCard label="Tổng số trận" value={fmtNum(d.totalMatches)} icon={<Swords className="size-5" />} tone="tertiary" hint="Mọi mùa, Ranked + Friendly" />
              <StatCard label="Online (mô phỏng)" value={fmtNum(d.simulatedOnlineCount)} icon={<Wifi className="size-5" />} tone="friendly" hint={<Link to="/online" className="underline-offset-2 hover:underline">Heartbeat giả lập, không phải đăng nhập thật</Link>} />
              <StatCard
                label="Mùa đang xem"
                value={<span className="text-lg">{d.selectedSeason?.name ?? 'Chưa có mùa'}</span>}
                icon={<Gamepad2 className="size-5" />}
                tone="secondary"
                hint={d.selectedSeason && <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><SeasonBadge status={d.selectedSeason.status} /><span>Thắng Ranked +{d.selectedSeason.rankedWinPoints}</span></span>}
              />
            </div>

            <section>
              <SectionTitle aside={<Link to={`/leaderboard${qs({ season: selected })}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">Xem bảng đầy đủ <ArrowRight className="size-4" aria-hidden /></Link>}>
                <span className="inline-flex items-center gap-2"><Trophy className="size-5 text-gold" aria-hidden /> Top 3 mùa giải</span>
              </SectionTitle>
              {d.top3.length ? <Podium items={d.top3} /> : <EmptyState title="Mùa này chưa có người chơi xếp hạng" />}
            </section>

            <section>
              <SectionTitle aside={<Link to="/history" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">Lịch sử trận <ArrowRight className="size-4" aria-hidden /></Link>}>
                Trận mới nhất
              </SectionTitle>
              {d.recentMatches.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {d.recentMatches.map((m) => <MatchCard key={m.id} m={m} />)}
                </div>
              ) : (
                <Card><EmptyState title="Chưa có trận nào" hint="Admin ghi nhận trận tại trang Quản lý trận đấu." /></Card>
              )}
            </section>
          </div>
        )}
      </Async>
    </>
  );
}
