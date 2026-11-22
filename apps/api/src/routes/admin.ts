import { Router } from "express";
import { z } from "zod";
import { ok } from "../http.js";
import { MODES } from "../keys.js";
import {
  activityQuery,
  adminDashboard,
  listActivity,
  redisOverview,
} from "../modules/admin-overview.js";
import { requireAdmin } from "../modules/auth.js";
import {
  gamePatchSchema,
  getGameConfig,
  getSettings,
  setModeEnabled,
  settingsPatchSchema,
  updateGame,
  updateSettings,
} from "../modules/game.js";
import {
  listMatches,
  matchCreateSchema,
  matchListQuery,
  recordMatch,
} from "../modules/matches.js";
import {
  createPlayer,
  listPlayers,
  playerCreateSchema,
  playerListQuery,
  playerPatchSchema,
  playerStatusSchema,
  setPlayerStatus,
  simulateHeartbeat,
  updatePlayer,
} from "../modules/players.js";
import {
  activateSeason,
  closeSeason,
  createSeason,
  listSeasons,
  seasonCreateSchema,
} from "../modules/seasons.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const actor = (res: { locals: Record<string, any> }) =>
  res.locals.admin.id as string;

adminRouter.get("/dashboard", async (_req, res) =>
  ok(res, await adminDashboard()),
);
adminRouter.get("/redis-overview", async (_req, res) =>
  ok(res, await redisOverview()),
);
adminRouter.get("/activity", async (req, res) =>
  ok(res, await listActivity(activityQuery.parse(req.query))),
);

adminRouter.get("/players", async (req, res) =>
  ok(res, await listPlayers(playerListQuery.parse(req.query))),
);
adminRouter.post("/players", async (req, res) =>
  ok(
    res,
    await createPlayer(playerCreateSchema.parse(req.body), actor(res)),
    201,
  ),
);
adminRouter.patch("/players/:id", async (req, res) =>
  ok(
    res,
    await updatePlayer(
      req.params.id,
      playerPatchSchema.parse(req.body),
      actor(res),
    ),
  ),
);
adminRouter.patch("/players/:id/status", async (req, res) =>
  ok(
    res,
    await setPlayerStatus(
      req.params.id,
      playerStatusSchema.parse(req.body).status,
      actor(res),
    ),
  ),
);
adminRouter.post("/players/:id/simulate-heartbeat", async (req, res) =>
  ok(res, await simulateHeartbeat(req.params.id, actor(res))),
);

adminRouter.get("/matches", async (req, res) =>
  ok(res, await listMatches(matchListQuery.parse(req.query), true)),
);
adminRouter.post("/matches", async (req, res) => {
  const result = await recordMatch(
    matchCreateSchema.parse(req.body),
    actor(res),
  );
  ok(res, result, result.alreadyProcessed ? 200 : 201);
});

adminRouter.get("/game", async (_req, res) => ok(res, await getGameConfig()));
adminRouter.patch("/game", async (req, res) =>
  ok(res, await updateGame(gamePatchSchema.parse(req.body), actor(res))),
);
adminRouter.patch("/game/modes/:mode", async (req, res) => {
  const mode = z.enum(MODES).parse(req.params.mode);
  const { enabled } = z
    .object({ enabled: z.boolean() })
    .strict()
    .parse(req.body);
  ok(res, await setModeEnabled(mode, enabled, actor(res)));
});

adminRouter.get("/seasons", async (_req, res) => ok(res, await listSeasons()));
adminRouter.post("/seasons", async (req, res) =>
  ok(
    res,
    await createSeason(seasonCreateSchema.parse(req.body), actor(res)),
    201,
  ),
);
adminRouter.post("/seasons/:id/activate", async (req, res) =>
  ok(res, await activateSeason(req.params.id, actor(res))),
);
adminRouter.post("/seasons/:id/close", async (req, res) =>
  ok(res, await closeSeason(req.params.id, actor(res))),
);

adminRouter.get("/settings", async (_req, res) => ok(res, await getSettings()));
adminRouter.patch("/settings", async (req, res) =>
  ok(
    res,
    await updateSettings(settingsPatchSchema.parse(req.body), actor(res)),
  ),
);
