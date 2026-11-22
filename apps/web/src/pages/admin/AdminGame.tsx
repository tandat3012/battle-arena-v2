import { CalendarPlus, Eye, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Async, Badge, Button, Card, ConfirmDialog, cx, EmptyState, Field, Input, PageHeader, SeasonBadge, SectionTitle, Select, useToast } from '../../components/ui';
import { api, ApiError, useApi, type Mode, type Season } from '../../lib/api';
import { fmtDate } from '../../lib/format';

interface Game {
  name: string;
  description: string;
  status: 'active' | 'maintenance';
  defaultRankedWinPoints: number;
  modes: Record<Mode, boolean>;
  updatedAt: string | null;
}

function GameInfo() {
  const game = useApi<Game>('/api/admin/game');
  const [form, setForm] = useState({ name: '', description: '', status: 'active' });
  const [saving, setSaving] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (game.data) setForm({ name: game.data.name, description: game.data.description, status: game.data.status });
  }, [game.data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('info');
    try {
      await api('/api/admin/game', { method: 'PATCH', body: form });
      toast('success', 'Đã lưu thông tin game');
      game.reload();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setSaving(null);
    }
  };

  const toggleMode = async (mode: Mode, enabled: boolean) => {
    setSaving(mode);
    try {
      await api(`/api/admin/game/modes/${mode}`, { method: 'PATCH', body: { enabled } });
      toast('success', `${enabled ? 'Đã bật' : 'Đã tắt'} ${mode === 'ranked_1v1' ? 'Ranked' : 'Friendly'}`);
      game.reload();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Async state={game} rows={3}>
      {(g) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle>Thông tin game</SectionTitle>
            <form onSubmit={save} className="flex flex-col gap-4">
              <Field label="Tên game" htmlFor="g-name"><Input id="g-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Mô tả" htmlFor="g-desc">
                <textarea id="g-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-line bg-bg/60 px-3 py-2 text-sm text-head focus:border-accent focus:outline-none" />
              </Field>
              <Field label="Trạng thái" htmlFor="g-status" hint="Bảo trì sẽ khóa ghi trận mới (kiểm tra trong Lua).">
                <Select id="g-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Hoạt động</option>
                  <option value="maintenance">Bảo trì</option>
                </Select>
              </Field>
              <div className="flex justify-end"><Button type="submit" loading={saving === 'info'}>Lưu</Button></div>
            </form>
          </Card>
          <Card>
            <SectionTitle>Chế độ đấu</SectionTitle>
            <ul className="flex flex-col gap-3">
              {([['ranked_1v1', 'Ranked 1v1', `Thắng +điểm theo mùa (mặc định ${g.defaultRankedWinPoints}), thua 0. Ảnh hưởng xếp hạng.`, 'text-accent'],
                 ['friendly_1v1', 'Friendly 1v1', 'Ghi lịch sử và thắng/thua, không đổi điểm xếp hạng.', 'text-friendly']] as const).map(([mode, label, desc, tone]) => (
                <li key={mode} className="flex items-center justify-between gap-4 rounded-xl border border-line p-4">
                  <div>
                    <p className={cx('font-display font-semibold', tone)}>{label} <span className="font-mono text-xs text-muted">{mode}</span></p>
                    <p className="mt-1 text-sm">{desc}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={g.modes[mode]}
                    aria-label={`${g.modes[mode] ? 'Tắt' : 'Bật'} ${label}`}
                    disabled={saving === mode}
                    onClick={() => toggleMode(mode, !g.modes[mode])}
                    className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', g.modes[mode] ? 'bg-friendly' : 'bg-line')}
                  >
                    <span className={cx('absolute top-1 left-0 size-5 rounded-full bg-head transition-transform', g.modes[mode] ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">Mode đã tắt: API trả 409 MODE_DISABLED, không ghi trận mới.</p>
          </Card>
        </div>
      )}
    </Async>
  );
}

function Seasons() {
  const seasons = useApi<{ items: Season[]; activeSeasonId: string | null }>('/api/admin/seasons');
  const [form, setForm] = useState({ seasonId: '', name: '' });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'activate' | 'close'; season: Season } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const active = seasons.data?.items.find((s) => s.status === 'active');

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateErr(null);
    try {
      await api('/api/admin/seasons', { method: 'POST', body: form });
      toast('success', `Đã tạo mùa ${form.name} (draft)`);
      setForm({ seasonId: '', name: '' });
      seasons.reload();
    } catch (err) {
      setCreateErr(err as ApiError);
    } finally {
      setCreating(false);
    }
  };

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const r = await api<{ participants?: number }>(`/api/admin/seasons/${confirm.season.id}/${confirm.action}`, { method: 'POST' });
      toast('success', confirm.action === 'activate' ? `Đã kích hoạt ${confirm.season.name} với ${r.participants} người chơi (0 điểm)` : `Đã đóng ${confirm.season.name}`);
      seasons.reload();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle>Tạo mùa mới (draft)</SectionTitle>
        <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <Field label="Mã mùa (seasonId)" htmlFor="s-id" hint="VD: s2026_03"><Input id="s-id" value={form.seasonId} onChange={(e) => setForm({ ...form, seasonId: e.target.value })} required /></Field>
          <Field label="Tên mùa" htmlFor="s-name" hint="Điểm thắng Ranked lấy theo mặc định trong Cài đặt"><Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Button type="submit" loading={creating} disabled={!form.seasonId || !form.name}><CalendarPlus className="size-4" aria-hidden />Tạo</Button>
        </form>
        {createErr && <p role="alert" className="mt-3 text-sm text-secondary">{createErr.message}{Array.isArray(createErr.details) && createErr.details.length ? `: ${(createErr.details as { message: string }[]).map((d) => d.message).join('; ')}` : ''}</p>}
      </Card>

      <Async state={seasons} rows={3} empty={(d) => !d.items.length && <EmptyState title="Chưa có mùa giải nào" />}>
        {(d) => (
          <div className="relative -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
              <thead><tr className="text-left text-xs tracking-wider text-muted uppercase">
                <th scope="col" className="px-4 py-1 font-medium">Mùa</th>
                <th scope="col" className="px-4 py-1 font-medium">Trạng thái</th>
                <th scope="col" className="px-4 py-1 font-medium">Người tham gia</th>
                <th scope="col" className="px-4 py-1 font-medium">Số trận</th>
                <th scope="col" className="px-4 py-1 font-medium">Điểm thắng</th>
                <th scope="col" className="px-4 py-1 font-medium">Thời gian</th>
                <th scope="col" className="px-4 py-1 text-right font-medium">Thao tác</th>
              </tr></thead>
              <tbody>
                {d.items.map((s) => (
                  <tr key={s.id} className={cx('bg-surface [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl', s.status === 'active' && 'outline outline-friendly/40')}>
                    <td className="px-4 py-3"><p className="font-medium text-head">{s.name}</p><p className="font-mono text-xs text-muted">{s.id}</p></td>
                    <td className="px-4 py-3"><SeasonBadge status={s.status} /></td>
                    <td className="tabular px-4 py-3 text-head">{s.participantCount}</td>
                    <td className="tabular px-4 py-3 text-head">{s.matchCount}</td>
                    <td className="tabular px-4 py-3 text-accent">+{s.rankedWinPoints}</td>
                    <td className="px-4 py-3 text-xs">{s.startedAt ? `${fmtDate(s.startedAt)} → ${s.closedAt ? fmtDate(s.closedAt) : 'nay'}` : 'Chưa bắt đầu'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {s.status !== 'draft' && <Link to={`/leaderboard?season=${s.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-head hover:bg-surface-2"><Eye className="size-4" aria-hidden />BXH</Link>}
                        {s.status === 'draft' && <Button className="px-3" onClick={() => setConfirm({ action: 'activate', season: s })}><Play className="size-4" aria-hidden />Kích hoạt</Button>}
                        {s.status === 'active' && <Button variant="danger" className="px-3" onClick={() => setConfirm({ action: 'close', season: s })}><Square className="size-4" aria-hidden />Đóng</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'activate' ? 'Kích hoạt mùa giải?' : 'Đóng mùa giải?'}
        danger={confirm?.action === 'close'}
        confirmLabel={confirm?.action === 'activate' ? 'Kích hoạt' : 'Đóng mùa'}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={run}
        message={confirm?.action === 'activate' ? (
          <>
            Kích hoạt <strong className="text-head">{confirm.season.name}</strong>. Mọi người chơi active tham gia với <strong className="text-head">0 điểm</strong>.
            {active && <> Mùa đang chạy <strong className="text-head">{active.name}</strong> sẽ bị <strong className="text-secondary">đóng</strong> trong cùng thao tác nguyên tử và không thể mở lại.</>}
          </>
        ) : (
          <>Đóng <strong className="text-head">{confirm?.season.name}</strong>: bảng điểm được giữ để tra cứu nhưng không ghi thêm trận. Sau khi đóng sẽ <strong className="text-head">không có mùa active</strong> cho tới khi kích hoạt mùa khác.</>
        )}
      />
    </div>
  );
}

export default function AdminGame() {
  const [tab, setTab] = useState<'info' | 'seasons'>('info');
  return (
    <>
      <PageHeader title="Game & Mùa giải" subtitle="Một game Battle Arena, hai chế độ, nhiều mùa giải — tối đa một mùa active." />
      <div role="tablist" aria-label="Quản lý game" className="mb-6 flex flex-wrap gap-2">
        {([['info', 'Thông tin & chế độ'], ['seasons', 'Season Management']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cx('min-h-10 rounded-xl border px-4 text-sm transition-colors', tab === v ? 'border-accent bg-surface-2 font-semibold text-accent' : 'border-line text-body hover:text-head')}>
            {l}
          </button>
        ))}
        <Badge className="ml-auto hidden self-center border-line bg-surface-2 text-body sm:inline-flex">Hash ba:v2:game:config</Badge>
      </div>
      {tab === 'info' ? <GameInfo /> : <Seasons />}
    </>
  );
}
