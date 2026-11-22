import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, RotateCw, X } from 'lucide-react';
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react';
import type { ApiError, Mode, SeasonStatus } from '../lib/api';
import { avatarTone, flag, initials, MODE_LABEL, SEASON_STATUS_LABEL } from '../lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Layout primitives ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset,0_8px_24px_-12px_rgb(0_0_0/0.6)]', className)}>{children}</section>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export function StatCard({ label, value, icon, hint, tone = 'accent' }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode; tone?: 'accent' | 'friendly' | 'tertiary' | 'secondary' }) {
  const toneCls = { accent: 'text-accent', friendly: 'text-friendly', tertiary: 'text-tertiary', secondary: 'text-secondary' }[tone];
  return (
    <Card className="flex items-start gap-4">
      <div className={cx('grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-2', toneCls)} aria-hidden>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-body">{label}</p>
        <p className="tabular mt-1 font-display text-3xl leading-tight font-bold text-head">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

// ---------- Buttons & form ----------
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle';
export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const v = {
    primary: 'bg-accent text-accent-ink hover:bg-[#ff9d33] font-semibold disabled:bg-surface-3 disabled:text-muted disabled:opacity-100',
    ghost: 'border border-line text-head hover:bg-surface-2 hover:border-surface-3',
    subtle: 'bg-surface-2 text-head border border-line hover:bg-surface-3',
    danger: 'border border-secondary/70 text-secondary hover:bg-secondary hover:text-accent-ink font-semibold',
  }[variant];
  return (
    <button
      className={cx('inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50', v, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-head">{label}</label>
      {children}
      {error ? <p className="text-xs text-secondary" role="alert">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const inputCls = 'min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-head placeholder:text-muted transition-colors focus:border-accent focus:outline-none disabled:opacity-50 aria-[invalid=true]:border-secondary';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputCls, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(inputCls, 'pr-8', className)} {...rest}>{children}</select>;
}

/** Lựa chọn dạng nút (Top 5/10/Tất cả, Ranked/Friendly). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx('min-h-9 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40', value === o.value ? 'bg-accent font-semibold text-accent-ink' : 'text-body hover:text-head')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Badges ----------
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', className)}>{children}</span>;
}

export const ModeBadge = ({ mode }: { mode: Mode }) =>
  mode === 'ranked_1v1'
    ? <Badge className="border-accent bg-accent font-semibold text-accent-ink">{MODE_LABEL[mode]}</Badge>
    : <Badge className="border-friendly bg-friendly font-semibold text-accent-ink">{MODE_LABEL[mode]}</Badge>;

export const PlayerStatusBadge = ({ status }: { status: string }) =>
  status === 'inactive' ? <Badge className="border-tertiary/70 text-[#ff7aa8]">Đã vô hiệu hóa</Badge> : null;

export function SeasonBadge({ status }: { status: SeasonStatus }) {
  const cls = { active: 'border-friendly/70 text-friendly', draft: 'border-line bg-surface-2 text-body', closed: 'border-line bg-surface-2 text-muted' }[status];
  return <Badge className={cls}>{status === 'active' && <span className="size-1.5 rounded-full bg-friendly" aria-hidden />}{SEASON_STATUS_LABEL[status]}</Badge>;
}

export const Country = ({ code }: { code: string }) => (
  <span className="inline-flex items-center gap-1 text-sm text-body" title={code}>
    <span aria-hidden>{flag(code)}</span>
    <span className="font-mono text-xs">{code}</span>
  </span>
);

export function Avatar({ id, name, size = 'md' }: { id: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const s = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }[size];
  const tone = avatarTone(id);
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full bg-surface-2 font-display font-bold ring-2', s)} style={{ color: tone, ['--tw-ring-color' as string]: `${tone}80` }} aria-hidden>
      {initials(name)}
    </span>
  );
}

// ---------- States ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-2/70', className)} aria-hidden />;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14" />)}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-secondary/50 bg-surface px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-secondary" aria-hidden />
      <div>
        <p className="font-semibold text-head">Không tải được dữ liệu</p>
        <p className="mt-1 text-sm text-body">{error.message}{'code' in error && error.code ? ` (${error.code})` : ''}</p>
      </div>
      {onRetry && <Button variant="ghost" onClick={onRetry}><RotateCw className="size-4" aria-hidden />Thử lại</Button>}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="text-muted" aria-hidden>{icon ?? <Inbox className="size-8" />}</span>
      <p className="font-semibold text-head">{title}</p>
      {hint && <p className="max-w-md text-sm text-body">{hint}</p>}
    </div>
  );
}

/** Bọc phần nội dung có loading/error/empty thống nhất. */
export function Async<T>({ state, empty, children, rows }: { state: { data: T | null; error: ApiError | null; loading: boolean; reload: () => void }; empty?: (d: T) => ReactNode | false; children: (d: T) => ReactNode; rows?: number }) {
  if (state.loading && !state.data) return <LoadingBlock rows={rows} />;
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  const e = empty?.(state.data);
  return <>{e || children(state.data)}</>;
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Phân trang">
      <span className="text-body">Trang {page}/{pages} · {total} mục</span>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Trang trước"><ChevronLeft className="size-4" aria-hidden /></Button>
        <Button variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Trang sau"><ChevronRight className="size-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}

// ---------- Modal / Confirm ----------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-body shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm', wide ? 'max-w-2xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="grid size-10 place-items-center rounded-lg text-body hover:bg-surface-2 hover:text-head" aria-label="Đóng"><X className="size-5" aria-hidden /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} footer={<>
      <Button variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
      <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
    </>}>
      <div className="text-sm leading-relaxed">{message}</div>
    </Modal>
  );
}

// ---------- Toast ----------
type Toast = { id: number; kind: 'success' | 'error'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cx('pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur', t.kind === 'success' ? 'border-friendly/40 bg-[#14261f]/95 text-head' : 'border-secondary/50 bg-[#2a1517]/95 text-head')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
