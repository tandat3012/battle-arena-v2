import type { Request, Response } from 'express';
import { k } from '../keys.js';
import { redis, subscriber } from '../redis.js';

export interface ChangeEvent {
  type: 'leaderboard.changed' | 'season.changed';
  seasonId: string;
  matchId?: string;
}

/** PUBLISH chỉ gọi SAU khi Redis đã commit. Lỗi publish chỉ log: client vẫn refetch khi reconnect. */
export async function publishChange(evt: ChangeEvent) {
  try {
    await redis.publish(k.channel, JSON.stringify(evt));
  } catch (err) {
    console.error('[pubsub] publish failed', (err as Error).message);
  }
}

const clients = new Set<{ res: Response; seasonId?: string }>();

export async function startRealtimeBridge() {
  await subscriber.subscribe(k.channel, (message) => {
    let evt: ChangeEvent;
    try {
      evt = JSON.parse(message);
    } catch {
      return;
    }
    for (const c of clients) {
      // Client lọc theo mùa chỉ nhận event của mùa đó; season.changed gửi cho tất cả.
      if (evt.type === 'leaderboard.changed' && c.seasonId && c.seasonId !== evt.seasonId) continue;
      c.res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
    }
  });
}

/** SSE chỉ là tín hiệu invalidation; trình duyệt tự GET lại dữ liệu thật từ Redis. */
export function sseHandler(req: Request, res: Response) {
  const seasonId = typeof req.query.seasonId === 'string' ? req.query.seasonId : undefined;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: 3000\nevent: ready\ndata: ${JSON.stringify({ subscribed: subscriber.isReady })}\n\n`);
  const client = { res, seasonId };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(client);
  });
}
