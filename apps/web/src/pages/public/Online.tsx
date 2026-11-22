import { FlaskConical, RotateCw } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { Async, Avatar, Badge, Button, Card, Country, EmptyState, PageHeader, SectionTitle } from '../../components/ui';
import { useApi } from '../../lib/api';
import { fmtAgo, fmtDateTime } from '../../lib/format';

interface OnlinePlayer {
  id: string;
  displayName: string;
  country: string;
  level: number;
  status: string;
  lastSeen: string;
  secondsAgo: number;
}
interface OnlineData {
  simulated: true;
  windowSeconds: number;
  serverTime: string;
  count: number;
  online: OnlinePlayer[];
  recentlyOffline: OnlinePlayer[];
}

function Row({ p, online }: { p: OnlinePlayer; online: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
      <div className="relative">
        <Avatar id={p.id} name={p.displayName} size="sm" />
        <span className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface ${online ? 'bg-friendly' : 'bg-muted'}`} aria-hidden />
      </div>
      <Link to={`/players/${p.id}`} className="min-w-0 flex-1 hover:text-accent">
        <p className="truncate font-medium text-head">{p.displayName}</p>
        <p className="flex items-center gap-2 text-xs"><Country code={p.country} /> Lv {p.level}</p>
      </Link>
      <div className="text-right text-xs">
        <p className={online ? 'font-semibold text-friendly' : 'text-body'}>{online ? 'Online (mô phỏng)' : 'Offline'}</p>
        <p className="text-muted" title={fmtDateTime(p.lastSeen)}>{fmtAgo(p.secondsAgo)}</p>
      </div>
    </li>
  );
}

export default function Online() {
  const state = useApi<OnlineData>('/api/public/online');
  // Tự làm mới để thấy người chơi rơi khỏi cửa sổ thời gian
  useEffect(() => {
    const t = setInterval(state.reload, 15000);
    return () => clearInterval(t);
  }, [state.reload]);

  return (
    <>
      <PageHeader
        title="Người chơi hoạt động"
        subtitle="Danh sách hoạt động mô phỏng theo heartbeat do Admin tạo — không phải trạng thái đăng nhập thật."
        actions={<Button variant="ghost" onClick={state.reload}><RotateCw className="size-4" aria-hidden />Làm mới</Button>}
      />
      <Card className="mb-8 flex items-start gap-3 border-l-4 border-l-accent">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <p className="text-sm">
          Hệ thống <strong className="text-head">không có đăng nhập người chơi</strong>. Mỗi heartbeat ghi <code className="font-mono text-head">ZADD ba:v2:online:last_seen &lt;epoch ms&gt; &lt;playerId&gt;</code>.
          Người chơi được tính online nếu lastSeen nằm trong cửa sổ <strong className="text-head">{state.data?.windowSeconds ?? '…'} giây</strong>; quá cửa sổ thì hiển thị offline dù vẫn còn trong Sorted Set.
        </p>
      </Card>
      <Async state={state} rows={6}>
        {(d) => (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section>
              <SectionTitle aside={<Badge className="border-friendly/70 text-friendly">{d.count} online</Badge>}>Đang hoạt động</SectionTitle>
              {d.online.length ? <ul className="flex flex-col gap-2">{d.online.map((p) => <Row key={p.id} p={p} online />)}</ul> : <EmptyState title="Không có ai trong cửa sổ thời gian" hint="Admin có thể bấm “Heartbeat” tại trang Quản lý người chơi." />}
            </section>
            <section>
              <SectionTitle>Vừa hết cửa sổ</SectionTitle>
              {d.recentlyOffline.length ? <ul className="flex flex-col gap-2 opacity-80">{d.recentlyOffline.map((p) => <Row key={p.id} p={p} online={false} />)}</ul> : <EmptyState title="Chưa có ai rơi khỏi cửa sổ" />}
            </section>
          </div>
        )}
      </Async>
      <p className="mt-6 text-xs text-muted">Giờ máy chủ: {fmtDateTime(state.data?.serverTime)} · tự làm mới mỗi 15 giây</p>
    </>
  );
}
