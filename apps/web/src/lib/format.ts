const TZ = 'Asia/Ho_Chi_Minh';

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '—';

export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('vi-VN').format(n));

export function fmtAgo(seconds: number) {
  if (seconds < 60) return `${seconds} giây trước`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
}

/** Cờ quốc gia từ mã 2 chữ cái (regional indicator). Luôn hiển thị kèm mã chữ để đọc được khi thiếu font emoji. */
export const flag = (cc: string) =>
  /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';

export const COUNTRIES: [string, string][] = [
  ['VN', 'Việt Nam'], ['JP', 'Nhật Bản'], ['KR', 'Hàn Quốc'], ['US', 'Hoa Kỳ'], ['CN', 'Trung Quốc'], ['TH', 'Thái Lan'],
  ['SG', 'Singapore'], ['BR', 'Brazil'], ['DE', 'Đức'], ['FR', 'Pháp'], ['IN', 'Ấn Độ'],
];

export const MODE_LABEL = { ranked_1v1: 'Ranked', friendly_1v1: 'Friendly' } as const;
export const SEASON_STATUS_LABEL = { draft: 'Nháp', active: 'Đang diễn ra', closed: 'Đã đóng' } as const;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Màu avatar ổn định theo ID (chỉ trang trí, không mang nghĩa). */
const AVATAR_TONES = ['#ff8906', '#f25f4c', '#ff7aa8', '#2cb67d', '#ffd166', '#c9cbd9'];
export const avatarTone = (id: string) => AVATAR_TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
