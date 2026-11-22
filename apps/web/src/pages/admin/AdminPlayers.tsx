import { HeartPulse, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Async, Avatar, Button, ConfirmDialog, Country, EmptyState, Field, Input, Modal, PageHeader, Pagination, PlayerStatusBadge, Select, useToast } from '../../components/ui';
import { api, ApiError, type PlayerListItem } from '../../lib/api';
import { COUNTRIES } from '../../lib/format';
import { emptyFilters, PlayerFilterBar, usePlayerSearch } from '../public/Players';

type FormState = { playerId: string; displayName: string; country: string; level: string };

/** Lỗi zod từ API (details[].path) → hiển thị cạnh từng ô. */
const fieldErrors = (e: ApiError | null) =>
  Object.fromEntries(((Array.isArray(e?.details) ? e!.details : []) as { path: string; message: string }[]).map((d) => [d.path, d.message]));

function PlayerForm({ initial, editing, onDone, onCancel }: { initial: FormState; editing: boolean; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const errs = fieldErrors(error);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { displayName: f.displayName, country: f.country, level: Number(f.level) };
      if (editing) await api(`/api/admin/players/${f.playerId}`, { method: 'PATCH', body });
      else await api('/api/admin/players', { method: 'POST', body: { playerId: f.playerId, ...body } });
      toast('success', editing ? `Đã cập nhật ${f.displayName}` : `Đã tạo ${f.displayName} — tự tham gia mùa active với 0 điểm`);
      onDone();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Mã người chơi (playerId)" htmlFor="pf-id" error={errs.playerId} hint={editing ? 'Không đổi được ID' : '3–40 ký tự: chữ, số, _ hoặc -. Không tái sử dụng sau khi vô hiệu hóa.'}>
        <Input id="pf-id" value={f.playerId} onChange={set('playerId')} disabled={editing} required aria-invalid={Boolean(errs.playerId) || undefined} placeholder="player25" />
      </Field>
      <Field label="Tên hiển thị" htmlFor="pf-name" error={errs.displayName}>
        <Input id="pf-name" value={f.displayName} onChange={set('displayName')} required aria-invalid={Boolean(errs.displayName) || undefined} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Quốc gia" htmlFor="pf-c" error={errs.country}>
          <Select id="pf-c" value={f.country} onChange={set('country')}>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
          </Select>
        </Field>
        <Field label="Level (1–100)" htmlFor="pf-l" error={errs.level}>
          <Input id="pf-l" type="number" min={1} max={100} value={f.level} onChange={set('level')} required aria-invalid={Boolean(errs.level) || undefined} />
        </Field>
      </div>
      <p className="text-xs text-muted">Điểm, thắng/thua chỉ thay đổi qua ghi nhận trận — không sửa ở form hồ sơ.</p>
      {error && !Object.keys(errs).length && <p role="alert" className="rounded-xl border border-secondary/60 bg-surface-2 px-3 py-2 text-sm text-head">{error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Hủy</Button>
        <Button type="submit" loading={saving}>{editing ? 'Lưu thay đổi' : 'Tạo người chơi'}</Button>
      </div>
    </form>
  );
}

export default function AdminPlayers() {
  const [filters, setFilters] = useState(emptyFilters);
  const list = usePlayerSearch(filters, '/api/admin/players', 20);
  const [form, setForm] = useState<{ initial: FormState; editing: boolean } | null>(null);
  const [confirm, setConfirm] = useState<PlayerListItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const toggleStatus = async (p: PlayerListItem) => {
    const status = p.status === 'active' ? 'inactive' : 'active';
    setBusy(p.id);
    try {
      await api(`/api/admin/players/${p.id}/status`, { method: 'PATCH', body: { status } });
      toast('success', status === 'inactive' ? `Đã vô hiệu hóa ${p.displayName} (giữ nguyên điểm và lịch sử)` : `Đã kích hoạt lại ${p.displayName}`);
      list.reload();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const heartbeat = async (p: PlayerListItem) => {
    setBusy(`hb-${p.id}`);
    try {
      await api(`/api/admin/players/${p.id}/simulate-heartbeat`, { method: 'POST' });
      toast('success', `Heartbeat mô phỏng cho ${p.displayName} — xem trang Online`);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Quản lý người chơi"
        subtitle="Thêm, sửa hồ sơ, vô hiệu hóa mềm (không xóa cứng), mô phỏng heartbeat."
        actions={<Button onClick={() => setForm({ initial: { playerId: '', displayName: '', country: 'VN', level: '1' }, editing: false })}><Plus className="size-4" aria-hidden />Thêm người chơi</Button>}
      />
      <PlayerFilterBar value={filters} onChange={setFilters} query={list.data?.query} />
      <Async state={list} rows={8} empty={(d) => !d.items.length && <EmptyState title="Không có người chơi khớp bộ lọc" />}>
        {(d) => (
          <>
            <div className="relative -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead><tr className="text-left text-xs tracking-wider text-muted uppercase">
                  <th scope="col" className="px-4 py-1 font-medium">Người chơi</th>
                  <th scope="col" className="px-4 py-1 font-medium">Quốc gia</th>
                  <th scope="col" className="px-4 py-1 font-medium">Level</th>
                  <th scope="col" className="px-4 py-1 font-medium">Tổng thắng / thua</th>
                  <th scope="col" className="px-4 py-1 text-right font-medium">Thao tác</th>
                </tr></thead>
                <tbody>
                  {d.items.map((p) => (
                    <tr key={p.id} className="bg-surface [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar id={p.id} name={p.displayName} size="sm" />
                          <div className="min-w-0">
                            <Link to={`/players/${p.id}`} className="block truncate font-medium text-head hover:text-accent">{p.displayName}</Link>
                            <span className="font-mono text-xs text-muted">{p.id}</span>
                          </div>
                          <PlayerStatusBadge status={p.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3"><Country code={p.country} /></td>
                      <td className="tabular px-4 py-3 text-head">{p.level}</td>
                      <td className="tabular px-4 py-3"><span className="text-friendly">{p.totalWins}</span> / <span className="text-secondary">{p.totalLosses}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="subtle" className="px-3" onClick={() => heartbeat(p)} loading={busy === `hb-${p.id}`} disabled={p.status !== 'active'} title="Mô phỏng heartbeat (online)">
                            <HeartPulse className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Heartbeat</span>
                          </Button>
                          <Button variant="ghost" className="px-3" onClick={() => setForm({ initial: { playerId: p.id, displayName: p.displayName, country: p.country, level: String(p.level) }, editing: true })} aria-label={`Sửa ${p.displayName}`}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          {p.status === 'active' ? (
                            <Button variant="danger" className="px-3" onClick={() => setConfirm(p)} aria-label={`Vô hiệu hóa ${p.displayName}`}><PowerOff className="size-4" aria-hidden /></Button>
                          ) : (
                            <Button variant="ghost" className="px-3 text-friendly" onClick={() => toggleStatus(p)} loading={busy === p.id} aria-label={`Kích hoạt lại ${p.displayName}`}><Power className="size-4" aria-hidden /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.page} total={d.total} pageSize={d.pageSize} onPage={list.setPage} />
          </>
        )}
      </Async>

      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form?.editing ? 'Sửa hồ sơ người chơi' : 'Thêm người chơi'}>
        {form && <PlayerForm key={form.initial.playerId || 'new'} initial={form.initial} editing={form.editing} onCancel={() => setForm(null)} onDone={() => { setForm(null); list.reload(); }} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Vô hiệu hóa người chơi?"
        danger
        confirmLabel="Vô hiệu hóa"
        loading={busy === confirm?.id}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && toggleStatus(confirm)}
        message={<>
          <strong className="text-head">{confirm?.displayName}</strong> sẽ không thể tham gia trận mới hoặc được ping online.
          Điểm, thống kê và lịch sử trận <strong className="text-head">được giữ nguyên</strong>; có thể kích hoạt lại sau.
        </>}
      />
    </>
  );
}
