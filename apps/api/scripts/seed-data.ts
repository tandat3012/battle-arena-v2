// Dữ liệu mẫu V2 (SRS 9.1): 24 người chơi, 2 mùa, 34 trận. Thiết kế có chủ đích:
// - mùa 1 đóng / mùa 2 active, điểm từng mùa riêng
// - player23 inactive (có lịch sử mùa 1), player24 điểm 0 chưa đấu
// - mùa 2 có 3 người đồng 600 điểm (player05, player09, player10) để minh họa quy tắc đồng điểm
export const SEED_VERSION = 'v2-seed-1';

export const PLAYERS: [id: string, name: string, country: string, level: number][] = [
  ['player01', 'Nguyễn Văn Minh', 'VN', 12],
  ['player02', 'Trần Thị Lan', 'VN', 8],
  ['player03', 'Lê Hoàng Nam', 'VN', 15],
  ['player04', 'Phạm Quốc Huy', 'VN', 5],
  ['player05', 'Sakura Tanaka', 'JP', 18],
  ['player06', 'Kenji Watanabe', 'JP', 9],
  ['player07', 'Emily Carter', 'US', 21],
  ['player08', 'Jake Morrison', 'US', 3],
  ['player09', 'Kim Min-jun', 'KR', 25],
  ['player10', 'Park Ji-woo', 'KR', 14],
  ['player11', 'Li Wei', 'CN', 11],
  ['player12', 'Zhang Yu', 'CN', 7],
  ['player13', 'Somchai Thongdee', 'TH', 6],
  ['player14', 'Lucas Silva', 'BR', 17],
  ['player15', 'Ana Souza', 'BR', 10],
  ['player16', 'Max Müller', 'DE', 13],
  ['player17', 'Léa Dubois', 'FR', 4],
  ['player18', 'Tan Wei Ming', 'SG', 19],
  ['player19', 'Võ Thanh Tùng', 'VN', 10],
  ['player20', 'Ngô Bảo Châu', 'VN', 2],
  ['player21', 'Haruto Sato', 'JP', 22],
  ['player22', 'Olivia Brown', 'US', 16],
  ['player23', 'Choi Seo-yeon', 'KR', 1],
  ['player24', 'Arjun Mehta', 'IN', 1],
];

export const SEASONS = [
  { seasonId: 's2026_01', name: 'Mùa 1 — Khai màn', createdAt: '2026-09-28T02:00:00Z', startAt: '2026-10-01T01:00:00Z' },
  { seasonId: 's2026_02', name: 'Mùa 2 — Bứt phá', createdAt: '2026-10-29T02:00:00Z', startAt: '2026-11-01T01:00:00Z' },
];

// [mode R/F, player1 (số), player2 (số), người thắng: 1 hoặc 2]
type M = ['R' | 'F', number, number, 1 | 2];

export const SEASON1_MATCHES: M[] = [
  ['R', 1, 2, 1], ['R', 3, 4, 1], ['R', 5, 6, 1], ['R', 7, 8, 1],
  ['R', 9, 10, 1], ['R', 11, 12, 2], ['R', 13, 14, 2], ['R', 1, 3, 1],
  ['R', 5, 9, 2], ['R', 7, 14, 1], ['F', 15, 16, 2], ['F', 17, 18, 1],
  ['R', 23, 20, 1], ['R', 21, 22, 1], ['R', 9, 1, 1], ['F', 2, 19, 2],
];

export const SEASON2_MATCHES: M[] = [
  ['R', 1, 5, 2], ['R', 7, 9, 1], ['R', 3, 10, 2], ['R', 11, 12, 1],
  ['R', 14, 15, 2], ['R', 16, 18, 2], ['F', 1, 2, 1], ['R', 19, 4, 1],
  ['R', 5, 7, 2], ['R', 9, 13, 1], ['F', 21, 22, 2], ['R', 6, 8, 1],
  ['R', 10, 18, 1], ['R', 9, 3, 1], ['F', 5, 9, 1], ['R', 5, 11, 1],
  ['R', 20, 17, 2], ['R', 7, 15, 1],
];

export const ONLINE_NOW = ['player01', 'player05', 'player07', 'player09', 'player14', 'player18'];
export const ONLINE_STALE = ['player03', 'player10']; // ping 10 phút trước → offline
