import crypto from "crypto";
import { db } from "./database.js";
import { addXP } from "./xpService.js";

function nowIso() { return new Date().toISOString(); }

export function createTeam(userId, { name, description }) {
  if (!name?.trim()) return { error: "团队名必填", status: 400 };
  if (db.prepare("SELECT id FROM teams WHERE name=?").get(name.trim())) return { error: "团队名已存在", status: 409 };
  const id = crypto.randomUUID(); const ts = nowIso();
  db.prepare("INSERT INTO teams (id,name,description,owner_id,created_at) VALUES (?,?,?,?,?)").run(id, name.trim(), description||"", userId, ts);
  db.prepare("INSERT INTO team_members (id,team_id,user_id,role,joined_at) VALUES (?,?,?,'owner',?)").run(crypto.randomUUID(), id, userId, ts);
  return { team: getTeam(id) };
}

export function getTeam(id) {
  const t = db.prepare("SELECT t.*, u.username AS owner_name FROM teams t LEFT JOIN users u ON u.id=t.owner_id WHERE t.id=?").get(id);
  if (!t) return null;
  const members = db.prepare("SELECT tm.*, u.username, u.level FROM team_members tm LEFT JOIN users u ON u.id=tm.user_id WHERE tm.team_id=?").all(id);
  return { id: t.id, name: t.name, description: t.description, ownerId: t.owner_id, ownerName: t.owner_name, memberCount: members.length, members: members.map(m => ({ id: m.id, userId: m.user_id, username: m.username, role: m.role, level: m.level||1, joinedAt: m.joined_at })), createdAt: t.created_at };
}

export function listTeams() {
  return db.prepare(`
    SELECT t.*, u.username AS owner_name, COUNT(tm.id) AS member_count
    FROM teams t LEFT JOIN users u ON u.id=t.owner_id LEFT JOIN team_members tm ON tm.team_id=t.id
    GROUP BY t.id ORDER BY member_count DESC
  `).all().map(t => ({ id: t.id, name: t.name, description: t.description, ownerName: t.owner_name, memberCount: t.member_count, createdAt: t.created_at }));
}

export function joinTeam(teamId, userId) {
  if (db.prepare("SELECT id FROM team_members WHERE team_id=? AND user_id=?").get(teamId, userId)) return { error: "已在团队中", status: 400 };
  db.prepare("INSERT INTO team_members (id,team_id,user_id,role,joined_at) VALUES (?,?,?,'member',?)").run(crypto.randomUUID(), teamId, userId, nowIso());
  addXP(userId, 30);
  return { ok: true };
}

export function leaveTeam(teamId, userId) {
  const m = db.prepare("SELECT * FROM team_members WHERE team_id=? AND user_id=?").get(teamId, userId);
  if (!m) return { error: "不在团队中", status: 404 };
  if (m.role === "owner") return { error: "队长不能退出，请先转让或解散团队", status: 400 };
  db.prepare("DELETE FROM team_members WHERE id=?").run(m.id);
  return { ok: true };
}

export function getMyTeam(userId) {
  const m = db.prepare("SELECT team_id FROM team_members WHERE user_id=?").get(userId);
  return m ? getTeam(m.team_id) : null;
}

function periodClause(period) {
  const now = new Date();
  if (period === "day")    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() };
  if (period === "week")   return { start: new Date(now.getTime() - 7 * 86400000).toISOString() };
  if (period === "month")  return { start: new Date(now.getTime() - 30 * 86400000).toISOString() };
  return { start: null };
}

export function getTeamLeaderboard(type = "xp") {
  // XP 排行
  if (type === "xp") {
    return db.prepare(`
      SELECT t.id, t.name, u.username AS owner_name, COUNT(tm.id) AS member_count,
        COALESCE(SUM(us.xp), 0) AS value
      FROM teams t LEFT JOIN users u ON u.id=t.owner_id
      LEFT JOIN team_members tm ON tm.team_id=t.id
      LEFT JOIN users us ON us.id=tm.user_id
      GROUP BY t.id ORDER BY value DESC LIMIT 20
    `).all().map(formatRow);
  }

  // 总积分（悬赏答题累计得分）
  if (type === "total_score") {
    return db.prepare(`
      SELECT t.id, t.name, u.username AS owner_name, COUNT(DISTINCT tm.id) AS member_count,
        COALESCE(SUM(bs.score), 0) AS value
      FROM teams t LEFT JOIN users u ON u.id=t.owner_id
      LEFT JOIN team_members tm ON tm.team_id=t.id
      LEFT JOIN bounty_submissions bs ON bs.user_id=tm.user_id
      GROUP BY t.id ORDER BY value DESC LIMIT 20
    `).all().map(formatRow);
  }

  // 带时间段的积分
  const periods = ["daily_score", "weekly_score", "monthly_score", "daily_challenge_score"];
  if (periods.includes(type)) {
    const periodMap = { daily_score: "day", weekly_score: "week", monthly_score: "month", daily_challenge_score: "day" };
    const { start } = periodClause(periodMap[type]);
    const scoreTable = type === "daily_challenge_score" ? "daily_challenge_submissions" : "bounty_submissions";
    const scoreField = "score";
    return db.prepare(`
      SELECT t.id, t.name, u.username AS owner_name, COUNT(DISTINCT tm.id) AS member_count,
        COALESCE(SUM(s.${scoreField}), 0) AS value
      FROM teams t LEFT JOIN users u ON u.id=t.owner_id
      LEFT JOIN team_members tm ON tm.team_id=t.id
      LEFT JOIN ${scoreTable} s ON s.user_id=tm.user_id ${start ? "AND s.submitted_at >= ?" : ""}
      GROUP BY t.id ORDER BY value DESC LIMIT 20
    `).all(...(start ? [start] : [])).map(formatRow);
  }

  // 限时挑战积分（全部每日挑战累计）
  if (type === "challenge_score") {
    return db.prepare(`
      SELECT t.id, t.name, u.username AS owner_name, COUNT(DISTINCT tm.id) AS member_count,
        COALESCE(SUM(ds.score), 0) AS value
      FROM teams t LEFT JOIN users u ON u.id=t.owner_id
      LEFT JOIN team_members tm ON tm.team_id=t.id
      LEFT JOIN daily_challenge_submissions ds ON ds.user_id=tm.user_id
      GROUP BY t.id ORDER BY value DESC LIMIT 20
    `).all().map(formatRow);
  }

  return [];
}

function formatRow(row, i) {
  return { rank: i + 1, id: row.id, name: row.name, ownerName: row.owner_name, memberCount: row.member_count, value: row.value };
}
