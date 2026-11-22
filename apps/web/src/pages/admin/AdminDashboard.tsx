import { Activity, Database, EyeOff, Search, Swords, Users, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Async, Badge, Button, Card, EmptyState, PageHeader, SeasonBadge, SectionTitle, StatCard } from '../../components/ui';
import { api, useApi, type Season } from '../../lib/api';
import { fmtDateTime, fmtNum } from '../../lib/format';

interface ActivityItem { id: string; type: string; actorId: string; entityId: string; occurredAt: string; summary: string }
interface DashData {
  totalPlayers: number;
  activePlayers: number;
  inactivePlayers: number;
  totalMatches: number;
  simulatedOnlineCount: number;
  activeSeason: Season | null;
  seasonCount: number;
}
interface Overview {
  server: { redisVersion: string; mode: string; usedMemoryHuman: string; dbSize: number };
  namespace: string;
  scan: { scanned: number; truncated: boolean; limit: number; at: string; byType: Record<string, { count: number; samples: string[] }> };
  sensitiveKeysHidden: number;
  structures: { type: string; label: string; usage: string; exampleKey: string; value: string; commands: string[] }[];
  search: { index: string; numDocs: number | null; example: string };
  pubsub: { channel: string };
}

const TYPE_TONE: Record<string, string> = {
  string: 'text-gold', hash: 'text-accent', list: 'text-secondary', set: 'text-friendly', zset: 'text-tertiary', stream: 'text-silver',
};

const EVENT_TONE: Record<string, string> = {
  'match.recorded': 'border-accent/70 text-accent',
  'season.activated': 'border-friendly/70 text-friendly',
  'season.closed': 'border-tertiary/70 text-[#ff7aa8]',
  'player.deactivated': 'border-tertiary/70 text-[#ff7aa8]',
};

function ActivityLogs() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const load = async (from: string | null) => {
    setLoading(true);
    try {
      const d = await api<{ items: ActivityItem[]; nextCursor: string | null; total: number }>(`/api/admin/activity?limit=15${from ? `&cursor=${from}` : ''}`);
      setItems((old) => (from ? [...old, ...d.items] : d.items));
      setCursor(d.nextCursor);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => void load(null), []);

  return (
    <Card>
      <SectionTitle aside={<span className="text-xs text-muted">Stream <code className="font-mono">ba:v2:events</code> · {fmtNum(total)} sự kiện</span>}>
        <span className="inline-flex items-center gap-2"><Activity className="size-5 text-accent" aria-hidden />Activity Logs</span>
      </SectionTitle>
      {error && !items.length ? (
        <p className="text-sm text-secondary" role="alert">{error.message}</p>
      ) : !items.length && !loading ? (
        <EmptyState title="Chưa có sự kiện" />
      ) : (
        <div className="relative -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs tracking-wider text-muted uppercase">
              <th scope="col" className="py-2 pr-3 font-medium">Thời điểm</th>
              <th scope="col" className="py-2 pr-3 font-medium">Loại</th>
              <th scope="col" className="py-2 pr-3 font-medium">Nội dung</th>
              <th scope="col" className="py-2 font-medium">Thực hiện</th>
            </tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-line/50 last:border-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-body">{fmtDateTime(e.occurredAt)}</td>
                  <td className="py-2.5 pr-3"><Badge className={EVENT_TONE[e.type] ?? 'border-line bg-surface-2 text-body'}><span className="font-mono">{e.type}</span></Badge></td>
                  <td className="py-2.5 pr-3 text-head">{e.summary}</td>
                  <td className="py-2.5 font-mono text-xs text-body">{e.actorId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && <div className="mt-4 flex justify-center"><Button variant="ghost" loading={loading} onClick={() => load(cursor)}>Tải thêm (XREVRANGE)</Button></div>}
    </Card>
  );
}

export default function AdminDashboard() {
  const dash = useApi<DashData>('/api/admin/dashboard');
  const ov = useApi<Overview>('/api/admin/redis-overview');

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Thống kê quản trị, tổng quan dữ liệu Redis (chỉ đọc) và nhật ký nghiệp vụ." />
      <Async state={dash} rows={2}>
        {(d) => (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Hồ sơ người chơi" value={fmtNum(d.totalPlayers)} icon={<Users className="size-5" />} hint={`${d.activePlayers} active · ${d.inactivePlayers} đã vô hiệu hóa`} />
            <StatCard label="Tổng số trận" value={fmtNum(d.totalMatches)} icon={<Swords className="size-5" />} tone="tertiary" hint={d.activeSeason ? `${d.activeSeason.matchCount} trận ở mùa active` : undefined} />
            <StatCard label="Online mô phỏng" value={fmtNum(d.simulatedOnlineCount)} icon={<Wifi className="size-5" />} tone="friendly" />
            <StatCard label="Mùa active" value={<span className="text-lg">{d.activeSeason?.name ?? 'Không có'}</span>} icon={<Database className="size-5" />} tone="secondary"
              hint={d.activeSeason ? <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><SeasonBadge status="active" /><span>{d.activeSeason.participantCount} người · +{d.activeSeason.rankedWinPoints}/thắng</span></span> : 'Ghi trận đang bị khóa'} />
          </div>
        )}
      </Async>

      <section className="mb-8">
        <SectionTitle aside={<Button variant="ghost" onClick={ov.reload}>Quét lại</Button>}>
          <span className="inline-flex items-center gap-2"><Database className="size-5 text-accent" aria-hidden />Redis Data Overview</span>
        </SectionTitle>
        <Async state={ov} rows={3}>
          {(o) => (
            <div className="flex flex-col gap-4">
              <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>Redis <strong className="text-head">{o.server.redisVersion}</strong> ({o.server.mode})</span>
                <span>Bộ nhớ: <strong className="text-head">{o.server.usedMemoryHuman}</strong></span>
                <span>DBSIZE: <strong className="text-head">{fmtNum(o.server.dbSize)}</strong> key</span>
                <span>SCAN <code className="font-mono text-head">{o.namespace}*</code>: <strong className="text-head">{fmtNum(o.scan.scanned)}</strong> key{o.scan.truncated && ` (dừng ở giới hạn ${o.scan.limit})`} · {fmtDateTime(o.scan.at)}</span>
                <span className="inline-flex items-center gap-1"><EyeOff className="size-4" aria-hidden />{o.sensitiveKeysHidden} key session/rate-limit đã ẩn</span>
              </Card>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {o.structures.map((s) => (
                  <Card key={s.type} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-bold ${TYPE_TONE[s.type]}`}>{s.label}</h3>
                      <Badge className="border-line bg-surface-2 text-head"><span className="tabular">{fmtNum(o.scan.byType[s.type]?.count ?? 0)}</span> key</Badge>
                    </div>
                    <p className="text-sm">{s.usage}</p>
                    <code className="rounded-lg bg-bg/70 px-2 py-1.5 font-mono text-xs break-all text-head">{s.exampleKey}</code>
                    <p className="text-sm text-head">{s.value}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {s.commands.map((c) => <span key={c} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-body">{c}</span>)}
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="flex flex-col gap-2 text-sm">
                <p className="inline-flex items-center gap-2 font-semibold text-head"><Search className="size-4 text-accent" aria-hidden />Redis Search · Pub/Sub</p>
                <p>Index <code className="font-mono text-head">{o.search.index}</code>: <strong className="text-head">{o.search.numDocs ?? '?'}</strong> tài liệu (Hash người chơi). Ví dụ: <code className="font-mono text-xs break-all">{o.search.example}</code></p>
                <p>Channel Pub/Sub: <code className="font-mono text-head">{o.pubsub.channel}</code> (không phải key lưu dữ liệu)</p>
              </Card>
            </div>
          )}
        </Async>
      </section>

      <ActivityLogs />
    </>
  );
}
