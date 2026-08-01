import { db } from "./database.js";

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200, 6600, 8200, 10000, 12000, 15000];

export function addXP(userId, amount) {
  const user = db.prepare("SELECT xp, level FROM users WHERE id=?").get(userId);
  if (!user) return;
  const newXp = user.xp + amount;
  let newLevel = user.level;
  while (newLevel < LEVEL_THRESHOLDS.length && newXp >= LEVEL_THRESHOLDS[newLevel]) newLevel++;
  db.prepare("UPDATE users SET xp=?, level=? WHERE id=?").run(newXp, newLevel, userId);
  return { xp: newXp, level: newLevel, leveledUp: newLevel > user.level };
}

export function getLevelInfo(userId) {
  const user = db.prepare("SELECT xp, level FROM users WHERE id=?").get(userId);
  if (!user) return { xp: 0, level: 1, nextLevelXp: 100, progress: 0 };
  const currentThreshold = LEVEL_THRESHOLDS[user.level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[user.level] || currentThreshold + 1000;
  const progress = Math.min(100, Math.round(((user.xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100));
  return { xp: user.xp, level: user.level, nextLevelXp: nextThreshold, progress };
}
