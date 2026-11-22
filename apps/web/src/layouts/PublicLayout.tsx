import { History, LayoutDashboard, Menu, Shield, Swords, Trophy, Users, Wifi, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { cx } from '../components/ui';

const NAV = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/leaderboard', label: 'Bảng xếp hạng', icon: Trophy },
  { to: '/players', label: 'Người chơi', icon: Users },
  { to: '/history', label: 'Lịch sử trận', icon: History },
  { to: '/online', label: 'Online', icon: Wifi },
];

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Battle Arena — trang chủ">
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink"><Swords className="size-5" aria-hidden /></span>
      <span className="font-display text-lg font-bold text-head">Battle Arena</span>
    </Link>
  );
}

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const link = ({ isActive }: { isActive: boolean }) =>
    cx('flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm transition-colors', isActive ? 'bg-surface-2 font-semibold text-accent' : 'text-body hover:bg-surface-2 hover:text-head');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={link}><Icon className="size-4" aria-hidden />{label}</NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="hidden min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm text-head hover:bg-surface-2 sm:inline-flex">
              <Shield className="size-4" aria-hidden /> Admin
            </Link>
            <button className="grid size-10 place-items-center rounded-xl text-head hover:bg-surface-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Mở menu">
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" className="border-t border-line px-4 py-3 lg:hidden" aria-label="Điều hướng chính">
            <div className="flex flex-col gap-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={link}><Icon className="size-4" aria-hidden />{label}</NavLink>
              ))}
              <NavLink to="/admin" className={link}><Shield className="size-4" aria-hidden />Admin</NavLink>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Battle Arena · Dữ liệu đọc trực tiếp từ Redis V2 · Trạng thái online là <strong className="text-body">mô phỏng</strong>
      </footer>
    </div>
  );
}
