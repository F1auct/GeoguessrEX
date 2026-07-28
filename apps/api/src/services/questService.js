import { db } from "./database.js";
import { addXP } from "./xpService.js";
import { addSeasonXP } from "./seasonService.js";

function nowIso() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function cryptoId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

/** 获取指定类型的任务列表 */
export function getQuests(questType) {
  return db.prepare("SELECT * FROM season_quests WHERE quest_type = ?").all(questType);
}

/** 获取用户当日/当周任务进度 */
export function getUserQuestProgress(userId, date) {
  const quests = db.prepare("SELECT * FROM season_quests").all();
  const progress = db.prepare(
    "SELECT * FROM user_quest_progress WHERE user_id = ? AND date = ?"
  ).all(userId, date);

  const progressMap = {};
  for (const p of progress) progressMap[p.quest_id] = p;

  return quests.map(q => ({
    ...q,
    progress: progressMap[q.id] || { current_count: 0, completed: 0, claimed: 0 },
  }));
}

/** 追踪任务进度（通用） */
export function trackProgress(userId, targetType, increment = 1) {
  const date = targetType.startsWith("wq_") || targetType === "checkin_streak" ? getWeekStart() : todayStr();
  const quests = db.prepare("SELECT * FROM season_quests WHERE target_type = ?").all(targetType);
  if (!quests.length) return;

  for (const q of quests) {
    const dateForQuest = q.quest_type === "weekly" ? getWeekStart() : todayStr();
    let prog = db.prepare(
      "SELECT * FROM user_quest_progress WHERE user_id = ? AND quest_id = ? AND date = ?"
    ).get(userId, q.id, dateForQuest);

    if (!prog) {
      db.prepare(`
        INSERT INTO user_quest_progress (id, user_id, quest_id, current_count, completed, claimed, date, updated_at)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?)
      `).run(cryptoId("uqp"), userId, q.id, increment, dateForQuest, nowIso());
    } else if (!prog.completed) {
      const newCount = prog.current_count + increment;
      const completed = newCount >= q.target_count ? 1 : 0;
      db.prepare(
        "UPDATE user_quest_progress SET current_count = ?, completed = ?, updated_at = ? WHERE id = ?"
      ).run(newCount, completed, nowIso(), prog.id);
    }
  }
}

/** 领取任务奖励 */
export function claimQuestReward(userId, questId) {
  const date = todayStr();
  const q = db.prepare("SELECT * FROM season_quests WHERE id = ?").get(questId);
  if (!q) return { error: "任务不存在", status: 404 };

  const dateForQuest = q.quest_type === "weekly" ? getWeekStart() : todayStr();
  let prog = db.prepare(
    "SELECT * FROM user_quest_progress WHERE user_id = ? AND quest_id = ? AND date = ?"
  ).get(userId, questId, dateForQuest);

  if (!prog || !prog.completed) return { error: "任务未完成", status: 400 };
  if (prog.claimed) return { error: "奖励已领取", status: 400 };

  db.prepare("UPDATE user_quest_progress SET claimed = 1, updated_at = ? WHERE id = ?")
    .run(nowIso(), prog.id);

  if (q.reward_xp > 0) {
    addXP(userId, q.reward_xp);
    addSeasonXP(userId, q.reward_xp);
  }

  return { claimed: true, reward: { xp: q.reward_xp, coin: q.reward_coin } };
}

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}

/** 获取用户当前每日/每周/赛季任务及进度 */
export function getAllQuestProgress(userId) {
  const daily = getUserQuestProgress(userId, todayStr());
  const weekly = getUserQuestProgress(userId, getWeekStart());
  return {
    daily: daily.filter(q => q.quest_type === "daily"),
    weekly: daily.filter(q => q.quest_type === "weekly"),
    season: daily.filter(q => q.quest_type === "season"),
  };
}
