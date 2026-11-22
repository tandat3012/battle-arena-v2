import { readFileSync } from "node:fs";
import { createClient } from "redis";
import { config } from "./config.js";

export const redis = createClient({
  url: config.redisUrl,
  disableOfflineQueue: true,
});
// Pub/Sub cần connection riêng (connection ở subscriber mode không chạy lệnh thường được).
export const subscriber = redis.duplicate();

export type Redis = typeof redis;

function attachRedisLogging(name: string, client: Redis) {
  let lastErrorLog = 0;

  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastErrorLog >= 5000) {
      lastErrorLog = now;
      console.error(`[redis:${name}]`, err.message);
    }
  });

  client.on("reconnecting", () => {
    console.warn(`[redis:${name}] reconnecting...`);
  });

  client.on("ready", () => {
    console.info(`[redis:${name}] ready`);
  });
}

attachRedisLogging("main", redis);
attachRedisLogging("subscriber", subscriber);

// ---- Lua scripts: ----
const SCRIPT_NAMES = [
  "match-record",
  "login-attempt",
  "player-create",
  "season-create",
  "season-activate",
  "season-close",
  "season-set-points",
] as const;

type ScriptName = (typeof SCRIPT_NAMES)[number];

const sources = Object.fromEntries(
  SCRIPT_NAMES.map((n) => [
    n,
    readFileSync(new URL(`./lua/${n}.lua`, import.meta.url), "utf8"),
  ]),
) as Record<ScriptName, string>;

const shas: Partial<Record<ScriptName, string>> = {};

export async function runScript(
  name: ScriptName,
  keys: string[],
  args: (string | number)[],
): Promise<string[]> {
  const options = { keys, arguments: args.map(String) };
  try {
    shas[name] ??= await redis.scriptLoad(sources[name]);
    return (await redis.evalSha(shas[name]!, options)) as string[];
  } catch (err) {
    if (!String((err as Error).message).includes("NOSCRIPT")) throw err;
    shas[name] = await redis.scriptLoad(sources[name]);
    return (await redis.evalSha(shas[name]!, options)) as string[];
  }
}

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
  if (!subscriber.isOpen) await subscriber.connect();
}

export async function closeRedis() {
  for (const c of [subscriber, redis]) if (c.isOpen) await c.close();
}
