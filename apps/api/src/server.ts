import { createApp } from './app.js';
import { config } from './config.js';
import { ensureDefaultConfig } from './modules/game.js';
import { startRealtimeBridge } from './modules/realtime.js';
import { ensurePlayerIndex } from './modules/search-index.js';
import { closeRedis, connectRedis } from './redis.js';

async function bootstrap() {
  // Redis chưa sẵn sàng thì thử lại; API vẫn lắng nghe để /health/ready báo 503 thay vì sập.
  for (let i = 1; ; i++) {
    try {
      await connectRedis();
      await ensureDefaultConfig();
      if (await ensurePlayerIndex()) console.log('[init] created Redis Search index');
      await startRealtimeBridge();
      console.log(`[redis] connected ${config.redisUrl.replace(/\/\/.*@/, '//***@')}`);
      return;
    } catch (err) {
      console.error(`[redis] bootstrap attempt ${i} failed: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, Math.min(1000 * i, 5000)));
    }
  }
}

const server = createApp().listen(config.port, () => console.log(`[api] listening on :${config.port}`));
void bootstrap();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    server.close();
    await closeRedis().catch(() => {});
    process.exit(0);
  });
}
