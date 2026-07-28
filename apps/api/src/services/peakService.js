import { db } from "./database.js";
import { addXP } from "./xpService.js";

function nowIso() { return new Date().toISOString(); }
function cryptoId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

const TIERS_ELIGIBLE = ["diamond", "master", "grandmaster"];
const MIN_RANKED_MATCHES = 20;
const INITIAL_PEAK_SCORE = 1200;
const K_FACTOR = 32;

/** 检查巅峰赛是否开放（每日 18:00-24:00） */
export function isPeakOpen() {
  const hour = new Date().getHours();
  return hour >= 18 && hour < 24;
}

/** 检查用户是否有巅峰赛资格 */
export function checkPeakEligibility(userId) {
  const user = db.prepare("SELECT rank_tier, rank_stars FROM users WHERE id = ?").get(userId);
  if (!user) return { eligible: false, reason: "用户不存在" };

  if (!TIERS_ELIGIBLE.includes(user.rank_tier)) {
    return { eligible: false, reason: `段位不足，需要钻石及以上（当前：${user.rank_tier}）` };
  }

  // 本赛季排位场次
  const seasonStart = getSeasonStart();
  const matchCount = db.prepare(
    "SELECT COUNT(*) AS count FROM rank_matches WHERE (winner_id = ? OR loser_id = ?) AND created_at >= ?"
  ).get(userId, userId, seasonStart).count;

  if (matchCount < MIN_RANKED_MATCHES) {
    return { eligible: false, reason: `本赛季排位场次不足（${matchCount}/${MIN_RANKED_MATCHES}）` };
  }

  const peakScore = db.prepare("SELECT peak_score FROM users WHERE id = ?").get(userId).peak_score || INITIAL_PEAK_SCORE;

  return { eligible: true, peakScore, matchCount };
}

function getSeasonStart() {
  const now = new Date();
  const month = now.getMonth() + 1;
  // 赛季从每月1日开始
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/** 加入巅峰匹配队列 */
export function joinPeakQueue(userId) {
  if (!isPeakOpen()) return { error: "巅峰赛仅在 18:00-24:00 开放", status: 403 };

  const eligibility = checkPeakEligibility(userId);
  if (!eligibility.eligible) return { error: eligibility.reason, status: 403 };

  const existing = db.prepare("SELECT * FROM peak_queue WHERE user_id = ?").get(userId);
  if (existing) return { queued: true, message: "已在队列中" };

  db.prepare("INSERT INTO peak_queue (id, user_id, peak_score, joined_at) VALUES (?, ?, ?, ?)")
    .run(cryptoId("pq"), userId, eligibility.peakScore, nowIso());

  return { queued: true, peakScore: eligibility.peakScore };
}

/** 离开队列 */
export function leavePeakQueue(userId) {
  db.prepare("DELETE FROM peak_queue WHERE user_id = ?").run(userId);
  return { ok: true };
}

/** 查找巅峰赛对手（按积分接近匹配） */
export function findPeakMatch(userId) {
  const me = db.prepare("SELECT * FROM peak_queue WHERE user_id = ?").get(userId);
  if (!me) return null;

  // 清理 5 分钟以上的过期队列
  const cutoff = new Date(Date.now() - 300000).toISOString();
  db.prepare("DELETE FROM peak_queue WHERE joined_at < ?").run(cutoff);

  // 找到积分最接近的对手（±300 分范围内）
  const opponent = db.prepare(`
    SELECT * FROM peak_queue
    WHERE user_id != ? AND peak_score BETWEEN ? AND ?
    ORDER BY ABS(peak_score - ?) ASC, joined_at ASC LIMIT 1
  `).get(userId, me.peak_score - 300, me.peak_score + 300, me.peak_score);

  if (opponent) {
    db.prepare("DELETE FROM peak_queue WHERE user_id IN (?, ?)").run(userId, opponent.user_id);
    return { opponentId: opponent.user_id, opponentScore: opponent.peak_score };
  }

  return null;
}

/** 获取队列状态 */
export function getPeakQueueStatus(userId) {
  const me = db.prepare("SELECT * FROM peak_queue WHERE user_id = ?").get(userId);
  const eligibility = checkPeakEligibility(userId);
  return {
    inQueue: !!me,
    waitedMs: me ? Date.now() - new Date(me.joined_at).getTime() : 0,
    isOpen: isPeakOpen(),
    ...eligibility,
  };
}

/** 结算巅峰赛（ELO 变体积分） */
export function resolvePeakMatch(winnerId, loserId) {
  const winner = db.prepare("SELECT id, username, peak_score FROM users WHERE id = ?").get(winnerId);
  const loser = db.prepare("SELECT id, username, peak_score FROM users WHERE id = ?").get(loserId);
  if (!winner || !loser) return { error: "用户不存在" };

  const wBefore = winner.peak_score || INITIAL_PEAK_SCORE;
  const lBefore = loser.peak_score || INITIAL_PEAK_SCORE;

  // ELO 预期胜率
  const expectedWinner = 1 / (1 + Math.pow(10, (lBefore - wBefore) / 400));
  const wChange = Math.round(K_FACTOR * (1 - expectedWinner));
  const lChange = -wChange;

  const wAfter = wBefore + wChange;
  const lAfter = Math.max(0, lBefore + lChange);

  const now = nowIso();
  db.prepare("UPDATE users SET peak_score = ? WHERE id = ?").run(wAfter, winnerId);
  db.prepare("UPDATE users SET peak_score = ? WHERE id = ?").run(lAfter, loserId);

  db.prepare(`
    INSERT INTO peak_matches (id, winner_id, loser_id, winner_score_before, winner_score_after,
      loser_score_before, loser_score_after, winner_score_change, loser_score_change, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cryptoId("pm"), winnerId, loserId, wBefore, wAfter, lBefore, lAfter, wChange, lChange, now);

  addXP(winnerId, 100);

  return {
    winner: { id: winnerId, username: winner.username, scoreBefore: wBefore, scoreAfter: wAfter, change: wChange },
    loser: { id: loserId, username: loser.username, scoreBefore: lBefore, scoreAfter: lAfter, change: lChange },
  };
}

/** 巅峰赛排行榜 */
export function getPeakLeaderboard(limit = 50) {
  const users = db.prepare("SELECT id, username, rank_tier, peak_score FROM users WHERE peak_score > 0 ORDER BY peak_score DESC LIMIT ?").all(limit);
  return users.map((u, i) => ({ ...u, rank: i + 1 }));
}

/** 个人巅峰赛历史 */
export function getPeakHistory(userId, limit = 20) {
  return db.prepare(`
    SELECT pm.*, w.username AS winner_name, l.username AS loser_name
    FROM peak_matches pm
    JOIN users w ON pm.winner_id = w.id
    JOIN users l ON pm.loser_id = l.id
    WHERE pm.winner_id = ? OR pm.loser_id = ?
    ORDER BY pm.created_at DESC LIMIT ?
  `).all(userId, userId, limit);
}
