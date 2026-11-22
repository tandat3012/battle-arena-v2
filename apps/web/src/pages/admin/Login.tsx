import { KeyRound, LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, Card, Field, Input } from '../../components/ui';
import { Brand } from '../../layouts/PublicLayout';
import { api, ApiError } from '../../lib/api';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  // Đã đăng nhập → vào thẳng Admin
  useEffect(() => {
    api('/api/auth/me').then(() => navigate(next, { replace: true })).catch(() => {});
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: { username, password } });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err as ApiError);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Brand /></div>
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-accent"><KeyRound className="size-5" aria-hidden /></span>
            <div>
              <h1 className="text-xl font-bold">Đăng nhập Admin</h1>
              <p className="text-xs text-muted">Phiên lưu trong Redis (String + TTL)</p>
            </div>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="Tên đăng nhập" htmlFor="username">
              <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </Field>
            <Field label="Mật khẩu" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-invalid={Boolean(error) || undefined} />
            </Field>
            {error && (
              <p role="alert" className="rounded-xl border border-secondary/60 bg-surface-2 px-3 py-2 text-sm text-head">
                {error.message}
              </p>
            )}
            <Button type="submit" loading={loading} disabled={!username || !password}><LogIn className="size-4" aria-hidden />Đăng nhập</Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-sm"><Link to="/" className="text-body hover:text-head">← Về trang công khai</Link></p>
      </div>
    </div>
  );
}
