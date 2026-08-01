import { db } from "./database.js";
import { addXP } from "./xpService.js";

function nowIso() { return new Date().toISOString(); }
function cryptoId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

const TIERS = ["bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster"];
const STARS_PER_TIER = 5;
const QUEUE_TIMEOUT_MS = 120000; // 2 min queue timeout

const TIER_LABELS = {
  bronze: "青铜", silver: "白银", gold: "黄金", platinum: "铂金",
  diamond: "钻石", master: "大师", grandmaster: "王者",
};

const TIER_COLORS = {
  bronze: "#8B6914", silver: "#8C92AC", gold: "#D4A017", platinum: "#4A90A4",
  diamond: "#7B68EE", master: "#FF6B6B", grandmaster: "#FFD700",
};

/** 获取用户排位信息 */
export function getUserRank(userId) {
  const user = db.prepare("SELECT id, username, rank_tier, rank_stars, rank_updated_at FROM users WHERE id = ?").get(userId);
  if (!user) return null;

  const tierIndex = TIERS.indexOf(user.rank_tier);
  const totalStars = tierIndex * STARS_PER_TIER + user.rank_stars;

  // 统计本周排位数据
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weeklyWins = db.prepare("SELECT COUNT(*) AS count FROM rank_matches WHERE winner_id = ? AND created_at >= ?").get(userId, weekAgo).count;
  const weeklyLosses = db.prepare("SELECT COUNT(*) AS count FROM rank_matches WHERE loser_id = ? AND created_at >= ?").get(userId, weekAgo).count;

  return {
    ...user,
    tierIndex,
    totalStars,
    tierLabel: TIER_LABELS[user.rank_tier] || user.rank_tier,
    tierColor: TIER_COLORS[user.rank_tier] || "#666",
    weeklyWins,
    weeklyLosses,
    weeklyWinRate: weeklyWins + weeklyLosses > 0 ? Math.round((weeklyWins / (weeklyWins + weeklyLosses)) * 100) : 0,
  };
}

/** 加入匹配队列 */
export function joinQueue(userId) {
  const user = db.prepare("SELECT rank_tier FROM users WHERE id = ?").get(userId);
  if (!user) return { error: "用户不存在", status: 404 };

  // 检查是否已在队列
  const existing = db.prepare("SELECT * FROM rank_queue WHERE user_id = ?").get(userId);
  if (existing) return { queued: true, message: "已在匹配队列中" };

  db.prepare("INSERT INTO rank_queue (id, user_id, tier, joined_at) VALUES (?, ?, ?, ?)")
    .run(cryptoId("rq"), userId, user.rank_tier, nowIso());

  return { queued: true, tier: user.rank_tier };
}

/** 离开匹配队列 */
export function leaveQueue(userId) {
  db.prepare("DELETE FROM rank_queue WHERE user_id = ?").run(userId);
  return { ok: true };
}

/** 查找匹配对手 */
export function findMatch(userId) {
  const me = db.prepare("SELECT * FROM rank_queue WHERE user_id = ?").get(userId);
  if (!me) return null;

  // 清理过期队列项
  const cutoff = new Date(Date.now() - QUEUE_TIMEOUT_MS).toISOString();
  db.prepare("DELETE FROM rank_queue WHERE joined_at < ?").run(cutoff);

  const myTierIdx = TIERS.indexOf(me.tier);

  // 优先同段位，逐步放宽到相邻段位
  for (let range = 0; range <= 2; range++) {
    const tiers = [];
    if (myTierIdx - range >= 0) tiers.push(TIERS[myTierIdx - range]);
    if (range > 0 && myTierIdx + range < TIERS.length) tiers.push(TIERS[myTierIdx + range]);

    const placeholders = tiers.map(() => "?").join(",");
    const opponent = db.prepare(`
      SELECT * FROM rank_queue WHERE tier IN (${placeholders}) AND user_id != ? ORDER BY joined_at ASC LIMIT 1
    `).get(...tiers, userId);

    if (opponent) {
      // 从队列移除双方
      db.prepare("DELETE FROM rank_queue WHERE user_id IN (?, ?)").run(userId, opponent.user_id);
      return { opponentId: opponent.user_id, opponentTier: opponent.tier };
    }
  }

  return null; // 未找到对手
}

/** 获取队列状态 */
export function getQueueStatus(userId) {
  const me = db.prepare("SELECT * FROM rank_queue WHERE user_id = ?").get(userId);
  if (!me) return { inQueue: false };
  const waitedMs = Date.now() - new Date(me.joined_at).getTime();
  return { inQueue: true, waitedMs, tier: me.tier };
}

/** 结算排位赛（胜者+1星，败者-1星） */
export function resolveRankedMatch(winnerId, loserId, roomId) {
  const winner = db.prepare("SELECT id, rank_tier, rank_stars FROM users WHERE id = ?").get(winnerId);
  const loser = db.prepare("SELECT id, rank_tier, rank_stars FROM users WHERE id = ?").get(loserId);
  if (!winner || !loser) return { error: "用户不存在" };

  const winnerTierBefore = winner.rank_tier;
  const winnerStarsBefore = winner.rank_stars;
  const loserTierBefore = loser.rank_tier;
  const loserStarsBefore = loser.rank_stars;

  // 胜者 +1 星
  let { tier: wTier, stars: wStars, change: wChange } = addStars(winner.rank_tier, winner.rank_stars, 1);

  // 败者 -1 星
  let { tier: lTier, stars: lStars, change: lChange } = addStars(loser.rank_tier, loser.rank_stars, -1);

  const now = nowIso();
  db.prepare("UPDATE users SET rank_tier = ?, rank_stars = ?, rank_updated_at = ? WHERE id = ?")
    .run(wTier, wStars, now, winnerId);
  db.prepare("UPDATE users SET rank_tier = ?, rank_stars = ?, rank_updated_at = ? WHERE id = ?")
    .run(lTier, lStars, now, loserId);

  // 记录比赛
  db.prepare(`
    INSERT INTO rank_matches (id, winner_id, loser_id, winner_tier_before, winner_stars_before,
      loser_tier_before, loser_stars_before, winner_stars_change, loser_stars_change, room_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cryptoId("rm"), winnerId, loserId, winnerTierBefore, winnerStarsBefore,
    loserTierBefore, loserStarsBefore, wChange, lChange, roomId, now);

  // XP 奖励
  addXP(winnerId, 80);

  const wPromoted = wTier !== winnerTierBefore && wChange > 0;
  const lDemoted = lTier !== loserTierBefore && lChange < 0;

  return {
    winner: { id: winnerId, tier: wTier, stars: wStars, tierLabel: TIER_LABELS[wTier], promoted: wPromoted, starsChange: wChange },
    loser: { id: loserId, tier: lTier, stars: lStars, tierLabel: TIER_LABELS[lTier], demoted: lDemoted, starsChange: lChange },
  };
}

function addStars(tier, stars, delta) {
  let tierIdx = TIERS.indexOf(tier);
  let newStars = stars + delta;
  let change = delta;

  if (newStars >= STARS_PER_TIER) {
    // 晋级
    if (tierIdx < TIERS.length - 1) {
      tierIdx++;
      newStars = 0;
      change = delta; // keep original delta for tracking
    } else {
      newStars = STARS_PER_TIER; // 王者上限
    }
  } else if (newStars < 0) {
    // 降级
    if (tierIdx > 0) {
      tierIdx--;
      newStars = STARS_PER_TIER - 1;
    } else {
      newStars = 0; // 青铜下限
    }
  }

  return { tier: TIERS[tierIdx], stars: newStars, change };
}

/** 排位排行榜 */
export function getRankedLeaderboard(limit = 50) {
  const tierOrder = "CASE rank_tier WHEN 'grandmaster' THEN 7 WHEN 'master' THEN 6 WHEN 'diamond' THEN 5 WHEN 'platinum' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 1 ELSE 0 END";
  const users = db.prepare(`SELECT id, username, rank_tier, rank_stars FROM users ORDER BY ${tierOrder} DESC, rank_stars DESC LIMIT ?`).all(limit);
  return users.map((u, i) => ({
    ...u,
    rank: i + 1,
    tierLabel: TIER_LABELS[u.rank_tier] || u.rank_tier,
    tierColor: TIER_COLORS[u.rank_tier] || "#666",
  }));
}

/** 用户排位历史 */
export function getRankedHistory(userId, limit = 20) {
  return db.prepare(`
    SELECT rm.*, w.username AS winner_name, l.username AS loser_name
    FROM rank_matches rm
    JOIN users w ON rm.winner_id = w.id
    JOIN users l ON rm.loser_id = l.id
    WHERE rm.winner_id = ? OR rm.loser_id = ?
    ORDER BY rm.created_at DESC LIMIT ?
  `).all(userId, userId, limit);
}

export { TIERS, STARS_PER_TIER, TIER_LABELS, TIER_COLORS };
