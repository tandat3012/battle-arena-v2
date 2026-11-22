import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = {},
  ) {
    super(message);
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
};

export function ok(res: Response, data: unknown, status = 200) {
  res
    .status(status)
    .json({ success: true, data, meta: { requestId: res.locals.requestId } });
}

function isRedisDown(err: unknown) {
  const e = err as { code?: string; name?: string; message?: string };
  return (
    e?.name === "ClientClosedError" ||
    e?.name === "ClientOfflineError" ||
    e?.code === "ECONNREFUSED" ||
    /The client is closed|Socket closed|connect ECONNREFUSED/.test(
      e?.message ?? "",
    )
  );
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const meta = { requestId: res.locals.requestId };
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
        meta,
      });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      meta,
    });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({
        success: false,
        error: { code: "BAD_JSON", message: "JSON không hợp lệ.", details: {} },
        meta,
      });
    return;
  }
  if (isRedisDown(err)) {
    res
      .status(503)
      .json({
        success: false,
        error: {
          code: "REDIS_UNAVAILABLE",
          message: "Không kết nối được Redis.",
          details: {},
        },
        meta,
      });
    return;
  }
  console.error(`[${meta.requestId}]`, err);
  res
    .status(500)
    .json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Lỗi máy chủ.", details: {} },
      meta,
    });
};

// Lua trả {'ERR', code} → ánh xạ HTTP + thông báo tiếng Việt.
const LUA_ERRORS: Record<string, [number, string]> = {
  MATCH_ID_CONFLICT: [409, "Mã trận đã được dùng cho kết quả khác."],
  NO_ACTIVE_SEASON: [409, "Hiện không có mùa giải đang hoạt động."],
  SEASON_NOT_ACTIVE: [409, "Mùa giải không ở trạng thái active."],
  GAME_MAINTENANCE: [409, "Game đang bảo trì, không thể ghi trận."],
  MODE_DISABLED: [409, "Chế độ đấu này đang bị tắt."],
  SAME_PLAYER: [422, "Hai người chơi phải khác nhau."],
  INVALID_WINNER: [422, "Người thắng phải là một trong hai người chơi."],
  PLAYER_NOT_FOUND: [404, "Không tìm thấy người chơi."],
  PLAYER_INACTIVE: [409, "Người chơi đã bị vô hiệu hóa."],
  NOT_PARTICIPANT: [409, "Người chơi không thuộc mùa giải này."],
  WRONG_KEY_TYPE: [500, "Dữ liệu Redis sai kiểu, cần kiểm tra."],
  INVALID_POINTS: [500, "Cấu hình điểm của mùa không hợp lệ."],
  PLAYER_EXISTS: [409, "Mã người chơi đã tồn tại (không tái sử dụng ID)."],
  SEASON_NOT_FOUND: [404, "Không tìm thấy mùa giải."],
  SEASON_NOT_DRAFT: [409, "Chỉ mùa ở trạng thái draft mới kích hoạt được."],
};

export function luaError(code: string, details: unknown = {}) {
  const [status, message] = LUA_ERRORS[code] ?? [500, code];
  return new AppError(status, code, message, details);
}
