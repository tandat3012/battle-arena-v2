import cookieParser from "cookie-parser";
import express from "express";
import { AppError, errorHandler, ok, requestId } from "./http.js";
import { k } from "./keys.js";
import { checkOrigin } from "./modules/auth.js";
import { redis, subscriber } from "./redis.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", "loopback, uniquelocal"); // nginx/Vite proxy → req.ip là IP thật cho rate-limit
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    });
    next();
  });

  app.get("/api/health/live", (_req, res) => ok(res, { live: true }));
  app.get("/api/health/ready", async (_req, res) => {
    try {
      await redis.ping();
      const indexes = await redis.ft._list();
      const searchReady = indexes.includes(k.playerIndex);
      const ready = searchReady && subscriber.isReady;
      ok(
        res,
        {
          ready,
          redis: true,
          searchIndex: searchReady,
          pubsub: subscriber.isReady,
        },
        ready ? 200 : 503,
      );
    } catch {
      throw new AppError(503, "REDIS_UNAVAILABLE", "Không kết nối được Redis.");
    }
  });

  app.use("/api/public", publicRouter);
  app.use("/api/auth", checkOrigin, authRouter);
  app.use("/api/admin", checkOrigin, adminRouter);
  app.use("/api", (_req, _res) => {
    throw new AppError(404, "NOT_FOUND", "Không tìm thấy API.");
  });
  app.use(errorHandler);
  return app;
}
