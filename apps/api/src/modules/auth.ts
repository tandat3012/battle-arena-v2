import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { CookieOptions, RequestHandler } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../http.js';
import { k } from '../keys.js';
import { redis, runScript } from '../redis.js';

export const COOKIE_NAME = 'ba_session';
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

export const loginSchema = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) }).strict();

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/',
  maxAge: config.sessionTtlSeconds * 1000,
});

export async function login(username: string, password: string, ip: string) {
  const attemptsKey = k.loginAttempts(sha256(`${ip}|${username.toLowerCase()}`));
  const attempts = Number(await redis.get(attemptsKey)) || 0;
  if (attempts >= MAX_ATTEMPTS) {
    const ttl = await redis.ttl(attemptsKey);
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(Math.max(ttl, 1) / 60)} phút.`, { retryAfterSeconds: ttl });
  }
  if (!config.adminPasswordHash.startsWith('$2')) {
    throw new AppError(503, 'ADMIN_NOT_CONFIGURED', 'Chưa cấu hình ADMIN_PASSWORD_HASH (chạy: pnpm admin-hash).');
  }
  // So sánh hash luôn chạy kể cả khi sai username để không lộ username hợp lệ qua thời gian phản hồi.
  const passOk = await bcrypt.compare(password, config.adminPasswordHash);
  if (!passOk || username !== config.adminUsername) {
    // Check và INCR trong cùng Lua script để request song song không vượt ngưỡng.
    const [status, ttl] = await runScript('login-attempt', [attemptsKey], [MAX_ATTEMPTS, ATTEMPT_WINDOW_SECONDS]);
    if (status === 'LIMIT') {
      const retryAfterSeconds = Math.max(Number(ttl), 1);
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(retryAfterSeconds / 60)} phút.`, { retryAfterSeconds });
    }
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Sai tên đăng nhập hoặc mật khẩu.');
  }
  await redis.del(attemptsKey);
  const token = randomBytes(32).toString('base64url');
  // Chỉ lưu SHA-256 của token làm tên key; token gốc chỉ nằm trong cookie HttpOnly.
  await redis.set(k.session(sha256(token)), username, { EX: config.sessionTtlSeconds });
  return { token, admin: { id: username, username } };
}

export async function logout(token: string | undefined) {
  if (token) await redis.del(k.session(sha256(token)));
}

export async function getSessionAdmin(token: string | undefined) {
  if (!token || token.length > 100) return null;
  const adminId = await redis.get(k.session(sha256(token)));
  return adminId ? { id: adminId, username: adminId } : null;
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const admin = await getSessionAdmin(req.cookies?.[COOKIE_NAME]);
  if (!admin) throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  res.locals.admin = admin;
  next();
};

/** Chỉ cho phép request ghi từ origin của ứng dụng; same-origin Fetch Metadata là fallback cho client thiếu Origin. */
export const checkOrigin: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    if (!config.allowedOrigins.includes(origin)) {
      throw new AppError(403, 'FORBIDDEN_ORIGIN', 'Origin không được phép.');
    }
    return next();
  }
  if (req.get('sec-fetch-site') !== 'same-origin') {
    throw new AppError(403, 'FORBIDDEN_ORIGIN', 'Origin không được phép.');
  }
  next();
};
