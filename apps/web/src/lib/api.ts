import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = {},
  ) {
    super(message);
  }
}

/** Gọi API cùng origin (Vite proxy / nginx). 401 trên route Admin → phát sự kiện để layout chuyển về login. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "include",
      headers:
        init.body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ API.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const e = json?.error ?? {};
    if (res.status === 401 && path.startsWith("/api/admin"))
      window.dispatchEvent(new Event("auth:expired"));
    throw new ApiError(
      res.status,
      e.code ?? "HTTP_ERROR",
      e.message ?? `Lỗi HTTP ${res.status}`,
      e.details,
    );
  }
  return json.data as T;
}

/** GET có trạng thái loading/error/data + reload(). path = null → chưa gọi. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    // Lần tải lại (SSE/refresh) giữ dữ liệu cũ trên màn hình, không nháy skeleton
    if (!hasData.current) setLoading(true);
    api<T>(path, { signal: ctrl.signal })
      .then((d) => {
        hasData.current = true;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [path, tick]);

  useEffect(() => {
    hasData.current = false;
  }, [path]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export type LiveStatus = "connecting" | "live" | "offline";

/**
 * Pub/Sub → SSE: chỉ là tín hiệu "dữ liệu đã đổi". Mỗi lần nhận event, kết nối lại, hay tab focus lại
 * đều gọi onChange để GET lại trạng thái thật từ Redis (Pub/Sub không lưu lịch sử).
 */
export function useLiveRefresh(
  seasonId: string | null | undefined,
  onChange: () => void,
) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const url = `/api/public/events/leaderboard${seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ""}`;
    const es = new EventSource(url);
    let opened = false;
    const fire = () => cb.current();
    es.addEventListener("ready", () => {
      setStatus("live");
      if (opened) fire(); // reconnect → refetch
      opened = true;
    });
    es.addEventListener("leaderboard.changed", fire);
    es.addEventListener("season.changed", fire);
    es.onerror = () =>
      setStatus(
        es.readyState === EventSource.CLOSED ? "offline" : "connecting",
      );
    const onFocus = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      es.close();
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [seasonId]);

  return status;
}

// ---- Kiểu dữ liệu API dùng chung ----
export type Mode = "ranked_1v1" | "friendly_1v1";
export type SeasonStatus = "draft" | "active" | "closed";

export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  rankedWinPoints: number;
  createdAt: string | null;
  startedAt: string | null;
  closedAt: string | null;
  participantCount: number;
  matchCount: number;
}

export interface PlayerRef {
  id: string;
  displayName: string;
  country: string;
  status: string;
}

export interface Match {
  id: string;
  seasonId: string;
  mode: Mode;
  player1: PlayerRef;
  player2: PlayerRef;
  winnerId: string;
  loserId: string;
  pointsAwarded: number;
  recordedAt: string;
  winnerScoreBefore: number;
  winnerScoreAfter: number;
  winnerRankBefore: number | null;
  winnerRankAfter: number | null;
  createdBy?: string;
}

export interface LeaderboardItem {
  rank: number;
  playerId: string;
  displayName: string;
  country: string;
  level: number;
  status: "active" | "inactive";
  score: number;
  rankedWins: number;
  rankedLosses: number;
  friendlyWins: number;
  friendlyLosses: number;
  winRate: number | null;
}

export interface PlayerListItem {
  id: string;
  displayName: string;
  country: string;
  level: number;
  status: "active" | "inactive";
  totalWins: number;
  totalLosses: number;
  createdAt: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const qs = (
  params: Record<string, string | number | undefined | null | false>,
) => {
  const p = new URLSearchParams();
  for (const [key, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "" && v !== false)
      p.set(key, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
