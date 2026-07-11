import crypto from "crypto";
import { db } from "./database.js";

function nowIso() { return new Date().toISOString(); }

const PASS_LEVELS = [
  { level: 1, xp: 0, reward: "🎁 100 金币" },
  { level: 2, xp: 100, reward: "⭐ 50 XP 加成" },
  { level: 3, xp: 250, reward: "🏅 铜牌徽章" },
  { level: 4, xp: 450, reward: "🎁 200 金币" },
  { level: 5, xp: 700, reward: "🌟 赛季限定头像框" },
  { level: 6, xp: 1000, reward: "🎁 300 金币" },
  { level: 7, xp: 1350, reward: "⭐ 100 XP 加成" },
  { level: 8, xp: 1750, reward: "🏅 银牌徽章" },
  { level: 9, xp: 2200, reward: "🎁 500 金币" },
  { level: 10, xp: 2700, reward: "👑 金牌徽章" },
  { level: 11, xp: 3300, reward: "🎁 800 金币" },
  { level: 12, xp: 4000, reward: "💎 钻石徽章" },
  { level: 13, xp: 4800, reward: "🎁 1200 金币" },
  { level: 14, xp: 5700, reward: "⭐ 200 XP 加成" },
  { level: 15, xp: 6700, reward: "🔥 传说赛季皮肤" },
  { level: 16, xp: 7800, reward: "🎁 2000 金币" },
  { level: 17, xp: 9000, reward: "🏅 史诗徽章" },
  { level: 18, xp: 10400, reward: "🎁 3000 金币" },
  { level: 19, xp: 12000, reward: "⭐ 500 XP 加成" },
  { level: 20, xp: 14000, reward: "🏆 赛季王者徽章 + 5000 金币" },
];

function getOrCreateCurrentSeason() {
  const now = nowIso();
  let season = db.prepare("SELECT * FROM seasons WHERE start_date <= ? AND end_date >= ? ORDER BY season_number DESC LIMIT 1").get(now, now);
  if (!season) {
    // 创建新赛季（每月1号开始，月底结束）
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const num = d.getFullYear() * 12 + d.getMonth() + 1;
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO seasons (id,name,season_number,start_date,end_date,theme,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(id, `${d.getFullYear()}年${d.getMonth()+1}月赛季`, num, start, end, "月度挑战", now);
    season = db.prepare("SELECT * FROM seasons WHERE id=?").get(id);
  }
  return season;
}

export function getCurrentSeason() {
  const season = getOrCreateCurrentSeason();
  return {
    id: season.id, name: season.name, seasonNumber: season.season_number,
    startDate: season.start_date, endDate: season.end_date, theme: season.theme,
    levels: PASS_LEVELS
  };
}

export function getUserPass(userId) {
  const season = getOrCreateCurrentSeason();
  let pass = db.prepare("SELECT * FROM season_pass WHERE user_id=? AND season_id=?").get(userId, season.id);
  if (!pass) {
    db.prepare("INSERT INTO season_pass (id,user_id,season_id,level,xp) VALUES (?,?,?,1,0)")
      .run(crypto.randomUUID(), userId, season.id);
    pass = { level: 1, xp: 0 };
  }
  const levelInfo = PASS_LEVELS[pass.level - 1] || PASS_LEVELS[PASS_LEVELS.length - 1];
  const nextLevel = PASS_LEVELS[pass.level] || null;
  const progress = nextLevel ? Math.min(100, Math.round(((pass.xp - levelInfo.xp) / (nextLevel.xp - levelInfo.xp)) * 100)) : 100;
  return {
    level: pass.level, xp: pass.xp, maxLevel: PASS_LEVELS.length,
    currentReward: levelInfo.reward, nextReward: nextLevel?.reward || "已满级",
    progress, nextLevelXp: nextLevel?.xp || 0,
    levels: PASS_LEVELS.map(l => ({
      ...l,
      unlocked: pass.level > l.level || (pass.level === l.level && progress >= 100),
      current: l.level === pass.level
    }))
  };
}

export function addSeasonXP(userId, amount) {
  const season = getOrCreateCurrentSeason();
  let pass = db.prepare("SELECT * FROM season_pass WHERE user_id=? AND season_id=?").get(userId, season.id);
  if (!pass) {
    db.prepare("INSERT INTO season_pass (id,user_id,season_id,level,xp) VALUES (?,?,?,1,0)").run(crypto.randomUUID(), userId, season.id);
    pass = { level: 1, xp: 0 };
  }
  let newXp = pass.xp + amount;
  let newLevel = pass.level;
  while (newLevel < PASS_LEVELS.length && newXp >= PASS_LEVELS[newLevel].xp) {
    // 发放升级奖励
    const reward = PASS_LEVELS[newLevel].reward;
    if (reward.includes("金币")) {
      const coinAmount = parseInt(reward.match(/\d+/)?.[0] || "0");
      if (coinAmount > 0) {
        db.prepare("UPDATE wallets SET balance_coin=balance_coin+?, updated_at=? WHERE user_id=?").run(coinAmount, nowIso(), userId);
      }
    }
    newLevel++;
  }
  // 上限等级
  if (newLevel > PASS_LEVELS.length) newLevel = PASS_LEVELS.length;
  db.prepare("UPDATE season_pass SET level=?, xp=? WHERE user_id=? AND season_id=?").run(newLevel, newXp, userId, season.id);
  return { xp: newXp, level: newLevel, leveledUp: newLevel > pass.level };
}

export function getSeasonLeaderboard() {
  const season = getOrCreateCurrentSeason();
  return db.prepare(`
    SELECT sp.*, u.username FROM season_pass sp
    JOIN users u ON u.id=sp.user_id
    WHERE sp.season_id=? ORDER BY sp.xp DESC LIMIT 50
  `).all(season.id).map((r, i) => ({ rank: i + 1, userId: r.user_id, username: r.username, level: r.level, xp: r.xp }));
}
