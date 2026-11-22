import { z } from "zod";
import { AppError } from "../http.js";
import { k, type Mode } from "../keys.js";
import { redis, runScript } from "../redis.js";
import { logEvent, toInt } from "./common.js";

export const DEFAULT_CONFIG = {
  name: "Battle Arena",
  description:
    "Đấu trường 1v1 — hệ thống quản lý bảng xếp hạng nhiều mùa giải.",
  status: "active",
  defaultRankedWinPoints: "300",
  onlineWindowSeconds: "120",
  recentHistoryLimit: "100",
  rankedEnabled: "true",
  friendlyEnabled: "true",
};

/** Tạo field cấu hình còn thiếu, không ghi đè giá trị đã có (HSETNX). */
export async function ensureDefaultConfig() {
  const multi = redis.multi();
  for (const [f, v] of Object.entries(DEFAULT_CONFIG))
    multi.hSetNX(k.config, f, v);
  multi.hSetNX(k.config, "updatedAt", new Date().toISOString());
  await multi.exec();
}

export async function getGameConfig() {
  const c = await redis.hGetAll(k.config);
  return {
    name: c.name ?? DEFAULT_CONFIG.name,
    description: c.description ?? "",
    status: (c.status ?? "active") as "active" | "maintenance",
    defaultRankedWinPoints: toInt(c.defaultRankedWinPoints, 300),
    onlineWindowSeconds: toInt(c.onlineWindowSeconds, 120),
    recentHistoryLimit: toInt(c.recentHistoryLimit, 100),
    modes: {
      ranked_1v1: c.rankedEnabled === "true",
      friendly_1v1: c.friendlyEnabled === "true",
    } as Record<Mode, boolean>,
    updatedAt: c.updatedAt ?? null,
  };
}

export const gamePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(300).optional(),
    status: z.enum(["active", "maintenance"]).optional(),
  })
  .strict();

export async function updateGame(
  patch: z.infer<typeof gamePatchSchema>,
  adminId: string,
) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [
    string,
    string,
  ][];
  if (!entries.length)
    throw new AppError(422, "EMPTY_PATCH", "Không có trường nào để cập nhật.");
  await redis.hSet(
    k.config,
    Object.fromEntries([...entries, ["updatedAt", new Date().toISOString()]]),
  );
  await logEvent(
    "game.updated",
    adminId,
    "game",
    `Cập nhật game: ${entries.map(([f]) => f).join(", ")}`,
    Object.fromEntries(entries),
  );
  return getGameConfig();
}

export async function setModeEnabled(
  mode: Mode,
  enabled: boolean,
  adminId: string,
) {
  const field = mode === "ranked_1v1" ? "rankedEnabled" : "friendlyEnabled";
  await redis.hSet(k.config, {
    [field]: String(enabled),
    updatedAt: new Date().toISOString(),
  });
  await logEvent(
    "game.updated",
    adminId,
    mode,
    `${enabled ? "Bật" : "Tắt"} chế độ ${mode}`,
    { mode, enabled },
  );
  return getGameConfig();
}

// ---- Settings (A06) ----
export const settingsPatchSchema = z
  .object({
    defaultRankedWinPoints: z.number().int().min(0).max(10000).optional(),
    activeSeasonRankedWinPoints: z.number().int().min(0).max(10000).optional(),
    onlineWindowSeconds: z.number().int().min(30).max(3600).optional(),
    recentHistoryLimit: z.number().int().min(20).max(500).optional(),
  })
  .strict();

export async function getSettings() {
  const cfg = await getGameConfig();
  const activeId = await redis.get(k.activeSeason);
  const activePoints = activeId
    ? await redis.hGet(k.season(activeId), "rankedWinPoints")
    : null;
  return {
    defaultRankedWinPoints: cfg.defaultRankedWinPoints,
    activeSeasonId: activeId,
    activeSeasonRankedWinPoints:
      activePoints == null ? null : toInt(activePoints),
    onlineWindowSeconds: cfg.onlineWindowSeconds,
    recentHistoryLimit: cfg.recentHistoryLimit,
  };
}

export async function updateSettings(
  patch: z.infer<typeof settingsPatchSchema>,
  adminId: string,
) {
  const now = new Date().toISOString();
  const { activeSeasonRankedWinPoints, ...configFields } = patch;
  const entries = Object.entries(configFields).filter(
    ([, v]) => v !== undefined,
  );
  if (!entries.length && activeSeasonRankedWinPoints === undefined) {
    throw new AppError(422, "EMPTY_PATCH", "Không có trường nào để cập nhật.");
  }
  if (activeSeasonRankedWinPoints !== undefined) {
    const activeId = await redis.get(k.activeSeason);
    if (!activeId)
      throw new AppError(
        409,
        "NO_ACTIVE_SEASON",
        "Không có mùa active để đổi điểm thắng.",
      );
    const [status] = await runScript(
      "season-set-points",
      [k.activeSeason, k.season(activeId)],
      [activeId, activeSeasonRankedWinPoints, now],
    );
    if (status !== "OK")
      throw new AppError(
        409,
        "NO_ACTIVE_SEASON",
        "Mùa active vừa thay đổi, hãy thử lại.",
      );
  }
  if (entries.length) {
    await redis.hSet(
      k.config,
      Object.fromEntries([
        ...entries.map(([f, v]) => [f, String(v)]),
        ["updatedAt", now],
      ]),
    );
  }
  await logEvent(
    "settings.updated",
    adminId,
    "settings",
    `Cập nhật cấu hình: ${Object.keys(patch).join(", ")}`,
    patch,
  );
  return getSettings();
}
