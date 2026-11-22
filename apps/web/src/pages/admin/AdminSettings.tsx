import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Async, Button, Card, Field, Input, PageHeader, useToast } from '../../components/ui';
import { api, ApiError, useApi } from '../../lib/api';

interface Settings {
  defaultRankedWinPoints: number;
  activeSeasonId: string | null;
  activeSeasonRankedWinPoints: number | null;
  onlineWindowSeconds: number;
  recentHistoryLimit: number;
}

const FIELDS = [
  { key: 'defaultRankedWinPoints', label: 'Điểm thắng Ranked mặc định (mùa mới)', min: 0, max: 10000, hint: 'Áp dụng khi tạo mùa mới. Mặc định 300.' },
  { key: 'activeSeasonRankedWinPoints', label: 'Điểm thắng Ranked của mùa active', min: 0, max: 10000, hint: 'Chỉ áp dụng cho trận ghi SAU thời điểm đổi; trận cũ giữ nguyên pointsAwarded.' },
  { key: 'onlineWindowSeconds', label: 'Cửa sổ online mô phỏng (giây)', min: 30, max: 3600, hint: 'Cho phép 30–3600. Mặc định 120.' },
  { key: 'recentHistoryLimit', label: 'Giới hạn danh sách trận gần đây (LTRIM)', min: 20, max: 500, hint: 'Cho phép 20–500. Mặc định 100.' },
] as const;

type Key = (typeof FIELDS)[number]['key'];

export default function AdminSettings() {
  const settings = useApi<Settings>('/api/admin/settings');
  const [form, setForm] = useState<Record<Key, string>>({ defaultRankedWinPoints: '', activeSeasonRankedWinPoints: '', onlineWindowSeconds: '', recentHistoryLimit: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();

  useEffect(() => {
    const s = settings.data;
    if (s) setForm({
      defaultRankedWinPoints: String(s.defaultRankedWinPoints),
      activeSeasonRankedWinPoints: s.activeSeasonRankedWinPoints == null ? '' : String(s.activeSeasonRankedWinPoints),
      onlineWindowSeconds: String(s.onlineWindowSeconds),
      recentHistoryLimit: String(s.recentHistoryLimit),
    });
  }, [settings.data]);

  const errs = Object.fromEntries(((Array.isArray(error?.details) ? error!.details : []) as { path: string; message: string }[]).map((d) => [d.path, d.message]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = settings.data!;
    // Chỉ gửi field thực sự thay đổi
    const body: Partial<Record<Key, number>> = {};
    for (const { key } of FIELDS) {
      if (form[key] === '') continue;
      const v = Number(form[key]);
      const orig = s[key];
      if (v !== orig) body[key] = v;
    }
    if (!Object.keys(body).length) return toast('success', 'Không có thay đổi');
    setSaving(true);
    setError(null);
    try {
      await api('/api/admin/settings', { method: 'PATCH', body });
      toast('success', 'Đã lưu cấu hình');
      settings.reload();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Cài đặt hệ thống" subtitle="Tham số nghiệp vụ được kiểm tra hợp lệ ở server. Website không cho chạy lệnh Redis tùy ý." />
      <Async state={settings} rows={4}>
        {(s) => (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <form onSubmit={save} className="flex flex-col gap-5" noValidate>
                {FIELDS.map((f) => {
                  const disabled = f.key === 'activeSeasonRankedWinPoints' && !s.activeSeasonId;
                  return (
                    <Field key={f.key} label={f.label} htmlFor={`st-${f.key}`} error={errs[f.key]} hint={disabled ? 'Không có mùa active.' : f.key === 'activeSeasonRankedWinPoints' ? `${f.hint} (mùa ${s.activeSeasonId})` : f.hint}>
                      <Input id={`st-${f.key}`} type="number" inputMode="numeric" min={f.min} max={f.max} value={form[f.key]} disabled={disabled}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-invalid={Boolean(errs[f.key]) || undefined} />
                    </Field>
                  );
                })}
                {error && !Object.keys(errs).length && <p role="alert" className="text-sm text-secondary">{error.message}</p>}
                <div className="flex justify-end"><Button type="submit" loading={saving}>Lưu cấu hình</Button></div>
              </form>
            </Card>
            <Card className="h-fit text-sm">
              <p className="mb-2 inline-flex items-center gap-2 font-semibold text-head"><ShieldCheck className="size-4 text-friendly" aria-hidden />Nơi lưu</p>
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                <li>Mặc định, cửa sổ online, giới hạn lịch sử: Hash <code className="font-mono text-head">ba:v2:game:config</code></li>
                <li>Điểm mùa active: field <code className="font-mono text-head">rankedWinPoints</code> trong Hash mùa, đổi bằng Lua kiểm tra pointer active</li>
                <li>Mỗi lần lưu ghi sự kiện <code className="font-mono text-head">settings.updated</code> vào Stream</li>
              </ul>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
