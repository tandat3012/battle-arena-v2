import { Router } from 'express';
import { AppError, ok } from '../http.js';
import { COOKIE_NAME, cookieOptions, getSessionAdmin, login, loginSchema, logout } from '../modules/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const { token, admin } = await login(username, password, req.ip ?? 'unknown');
  res.cookie(COOKIE_NAME, token, cookieOptions());
  ok(res, { authenticated: true, admin });
});

authRouter.get('/me', async (req, res) => {
  const admin = await getSessionAdmin(req.cookies?.[COOKIE_NAME]);
  if (!admin) throw new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập hoặc phiên đã hết hạn.');
  ok(res, { authenticated: true, admin });
});

authRouter.post('/logout', async (req, res) => {
  await logout(req.cookies?.[COOKIE_NAME]);
  const { maxAge: _, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
  ok(res, { authenticated: false });
});
