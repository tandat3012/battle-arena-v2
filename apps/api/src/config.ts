import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Dev local: đọc .env ở gốc repo. Trong Docker, compose truyền env sẵn.
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const isTest = process.env.NODE_ENV === 'test';

const schema = z.object({
  REDIS_URL: z.string().default('redis://127.0.0.1:6380'),
  REDIS_TEST_URL: z.string().default('redis://127.0.0.1:6390'),
  PORT: z.coerce.number().int().default(3001),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD_HASH: z.string().default(''),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).default(28800),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  APP_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
});

const env = schema.parse(process.env);

export const config = {
  redisUrl: isTest ? env.REDIS_TEST_URL : env.REDIS_URL,
  port: env.PORT,
  adminUsername: env.ADMIN_USERNAME,
  adminPasswordHash: env.ADMIN_PASSWORD_HASH,
  sessionTtlSeconds: env.SESSION_TTL_SECONDS,
  cookieSecure: env.COOKIE_SECURE === 'true',
  allowedOrigins: env.APP_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  isTest,
};
