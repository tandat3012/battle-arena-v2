// Nguồn sự thật cho tên key Redis (SRS mục 5.2). Chỉ gọi với ID đã validate.
export const NS = 'ba:v2:';

export const k = {
  config: `${NS}game:config`,
  players: `${NS}players`,
  player: (id: string) => `${NS}player:${id}`,
  playerMatches: (id: string) => `${NS}player:${id}:matches`,
  seasons: `${NS}seasons`,
  activeSeason: `${NS}season:active`,
  season: (id: string) => `${NS}season:${id}`,
  participants: (id: string) => `${NS}season:${id}:participants`,
  leaderboard: (id: string) => `${NS}season:${id}:leaderboard`,
  stats: (seasonId: string, playerId: string) => `${NS}season:${seasonId}:stats:${playerId}`,
  seasonMatches: (id: string) => `${NS}season:${id}:matches`,
  matchIds: `${NS}match:ids`,
  match: (id: string) => `${NS}match:${id}`,
  recent: `${NS}matches:recent`,
  online: `${NS}online:last_seen`,
  session: (digest: string) => `${NS}auth:session:${digest}`,
  loginAttempts: (digest: string) => `${NS}auth:login:attempts:${digest}`,
  events: `${NS}events`,
  seedVersion: `${NS}seed:version`,
  playerIndex: 'idx:ba:v2:players',
  channel: `${NS}leaderboard:changed`,
};

export const ID_RE = /^[a-zA-Z0-9_-]{3,40}$/;
export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MODES = ['ranked_1v1', 'friendly_1v1'] as const;
export type Mode = (typeof MODES)[number];
