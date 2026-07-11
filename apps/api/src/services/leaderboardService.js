import { db } from "./database.js";

function periodWhere(period) {
  const now = Date.now();
  if (period === "week") {
    const weekAgo = new Date(now - 7 * 86400000).toISOString();
    return { clause: "AND created_at >= ?", param: weekAgo };
  }
  if (period === "month") {
    const monthAgo = new Date(now - 30 * 86400000).toISOString();
    return { clause: "AND created_at >= ?", param: monthAgo };
  }
  return { clause: "", param: null };
}

export function getLeaderboard({ type = "score", period = "all" }) {
  const p = periodWhere(period);

  // 高分排行：经典答题最高分
  if (type === "score") {
    return db.prepare(`
      SELECT u.id, u.username, MAX(s.score) AS value
      FROM users u
      JOIN bounty_submissions s ON s.user_id = u.id
      WHERE 1=1 ${p.clause}
      GROUP BY u.id
      ORDER BY value DESC
      LIMIT 50
    `).all(...(p.param ? [p.param] : [])).map(row => ({
      userId: row.id,
      username: row.username,
      value: row.value || 0,
      display: `${row.value || 0} 分`
    }));
  }

  // 悬赏获胜次数
  if (type === "bounty") {
    return db.prepare(`
      SELECT u.id, u.username, COUNT(b.id) AS value
      FROM users u
      JOIN bounties b ON b.winner_id = u.id
      WHERE b.status = 'closed' ${p.clause}
      GROUP BY u.id
      ORDER BY value DESC
      LIMIT 50
    `).all(...(p.param ? [p.param] : [])).map(row => ({
      userId: row.id,
      username: row.username,
      value: row.value || 0,
      display: `${row.value || 0} 次`
    }));
  }

  // 藏宝通关次数
  if (type === "hunt") {
    return db.prepare(`
      SELECT u.id, u.username, COUNT(gp.id) AS value
      FROM users u
      JOIN game_progress gp ON gp.user_id = u.id AND gp.completed_at IS NOT NULL
      WHERE 1=1 ${p.clause.replace(/created_at/g, 'gp.completed_at')}
      GROUP BY u.id
      ORDER BY value DESC
      LIMIT 50
    `).all(...(p.param ? [p.param] : [])).map(row => ({
      userId: row.id,
      username: row.username,
      value: row.value || 0,
      display: `${row.value || 0} 次`
    }));
  }

  // 社区贡献：已批准帖子数
  if (type === "community") {
    return db.prepare(`
      SELECT u.id, u.username, COUNT(cp.id) AS value
      FROM users u
      JOIN community_posts cp ON cp.author_id = u.id
      WHERE cp.status = 'approved' ${p.clause}
      GROUP BY u.id
      ORDER BY value DESC
      LIMIT 50
    `).all(...(p.param ? [p.param] : [])).map(row => ({
      userId: row.id,
      username: row.username,
      value: row.value || 0,
      display: `${row.value || 0} 篇`
    }));
  }

  // 财富排行
  if (type === "wealth") {
    return db.prepare(`
      SELECT u.id, u.username, w.balance_coin AS value
      FROM users u
      JOIN wallets w ON w.user_id = u.id
      ORDER BY value DESC
      LIMIT 50
    `).all().map(row => ({
      userId: row.id,
      username: row.username,
      value: row.value || 0,
      display: `💰 ${row.value || 0}`
    }));
  }

  return [];
}
