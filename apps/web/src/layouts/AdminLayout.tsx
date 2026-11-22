import {
  ExternalLink,
  Gamepad2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Swords,
  Users,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import { cx, ErrorState } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { Brand } from "./PublicLayout";

type Admin = { id: string; username: string };
const AdminCtx = createContext<Admin | null>(null);
export const useAdmin = () => useContext(AdminCtx)!;

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/players", label: "Người chơi", icon: Users },
  { to: "/admin/matches", label: "Trận đấu", icon: Swords },
  { to: "/admin/game", label: "Game & Mùa giải", icon: Gamepad2 },
  { to: "/admin/settings", label: "Cài đặt", icon: Settings },
];

export function AdminLayout() {
  const [state, setState] = useState<{
    admin: Admin | null;
    error: ApiError | null;
    checked: boolean;
  }>({ admin: null, error: null, checked: false });

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const check = () =>
    api<{ admin: Admin }>("/api/auth/me")
      .then((d) => setState({ admin: d.admin, error: null, checked: true }))
      .catch((e: ApiError) =>
        setState({
          admin: null,
          error: e.status === 401 ? null : e,
          checked: true,
        }),
      );

  useEffect(() => {
    void check();
    const onExpired = () =>
      setState({ admin: null, error: null, checked: true });
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);
  useEffect(() => setOpen(false), [location.pathname]);

  if (!state.checked)
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <Loader2
          className="size-8 animate-spin text-accent"
          aria-label="Đang kiểm tra phiên đăng nhập"
        />
      </div>
    );
  if (state.error)
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorState error={state.error} onRetry={check} />
      </div>
    );
  if (!state.admin)
    return (
      <Navigate
        to={`/admin/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );

  const logout = async () => {
    setLoggingOut(true);
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    navigate("/admin/login", { replace: true });
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
      isActive
        ? "bg-accent font-semibold text-accent-ink"
        : "text-body hover:bg-surface-2 hover:text-head",
    );

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="hidden lg:block">
        <Brand />
      </div>
      <p className="px-3 text-xs font-semibold tracking-wider text-muted uppercase">
        Quản trị
      </p>
      <nav className="-mt-4 flex flex-col gap-1" aria-label="Điều hướng Admin">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={link}>
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
        <Link
          to="/"
          className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-body hover:bg-surface-2 hover:text-head"
        >
          <ExternalLink className="size-4" aria-hidden />
          Trang công khai
        </Link>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-head">
              {state.admin.username}
            </p>
            <p className="text-xs text-muted">Quản trị viên</p>
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="grid size-10 place-items-center rounded-lg text-body hover:bg-bg hover:text-secondary disabled:opacity-50"
            aria-label="Đăng xuất"
          >
            {loggingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AdminCtx.Provider value={state.admin}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface/70 lg:block">
          {sidebar}
        </aside>
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Brand />
          <button
            className="grid size-10 place-items-center rounded-xl text-head hover:bg-surface-2"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Mở menu Admin"
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </header>
        {open && (
          <div className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-y-auto border-t border-line bg-bg lg:hidden">
            {sidebar}
          </div>
        )}
        <main className="min-w-0 px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminCtx.Provider>
  );
}
