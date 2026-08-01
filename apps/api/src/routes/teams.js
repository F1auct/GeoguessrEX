import { requireAuth } from "../middleware/auth.js";
import { createTeam, getMyTeam, getTeam, getTeamLeaderboard, joinTeam, leaveTeam, listTeams } from "../services/teamService.js";
import { db } from "../services/database.js";

export function registerTeamRoutes(app) {
  app.get("/api/teams/leaderboard", (req, res) => {
    try { return res.json({ items: getTeamLeaderboard(req.query.type || "xp") }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // 团队成员详细统计
  app.get("/api/teams/:id/stats", (req, res) => {
    try {
      const members = db.prepare("SELECT tm.user_id, u.username, u.xp, u.level FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=?").all(req.params.id);
      const result = members.map(m => {
        const totalScore = db.prepare("SELECT COALESCE(SUM(score),0) AS s FROM bounty_submissions WHERE user_id=?").get(m.user_id).s;
        const bestScore = db.prepare("SELECT COALESCE(MAX(score),0) AS s FROM bounty_submissions WHERE user_id=?").get(m.user_id).s;
        const bountyWins = db.prepare("SELECT COUNT(*) AS c FROM bounties WHERE winner_id=?").get(m.user_id).c;
        const huntCompletions = db.prepare("SELECT COUNT(*) AS c FROM game_progress WHERE user_id=? AND completed_at IS NOT NULL").get(m.user_id).c;
        const posts = db.prepare("SELECT COUNT(*) AS c FROM community_posts WHERE author_id=? AND status='approved'").get(m.user_id).c;
        const dailyScore = db.prepare("SELECT COALESCE(SUM(score),0) AS s FROM daily_challenge_submissions WHERE user_id=?").get(m.user_id).s;
        const today = new Date().toISOString().slice(0,10);
        const todayScore = db.prepare("SELECT COALESCE(SUM(ds.score),0) AS s FROM daily_challenge_submissions ds JOIN daily_challenges dc ON dc.id=ds.challenge_id WHERE ds.user_id=? AND dc.date=?").get(m.user_id, today).s;
        const weeklyScore = db.prepare("SELECT COALESCE(SUM(score),0) AS s FROM bounty_submissions WHERE user_id=? AND submitted_at >= ?").get(m.user_id, new Date(Date.now()-7*86400000).toISOString()).s;
        return { userId: m.user_id, username: m.username, xp: m.xp, level: m.level, totalScore, bestScore, bountyWins, huntCompletions, posts, dailyScore, todayScore, weeklyScore };
      });
      return res.json({ members: result });
    } catch (e) { return res.status(500).json({ error: "获取成员统计失败" }); }
  });

  app.get("/api/teams", (req, res) => {
    try { return res.json({ items: listTeams() }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });
  app.get("/api/teams/my", requireAuth, (req, res) => {
    try { return res.json(getMyTeam(req.user.id) || null); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });
  app.get("/api/teams/:id", (req, res) => {
    try {
      const team = getTeam(req.params.id);
      if (!team) return res.status(404).json({ error: "团队不存在" });
      return res.json(team);
    } catch { return res.status(500).json({ error: "获取失败" }); }
  });
  app.post("/api/teams", requireAuth, (req, res) => {
    try {
      const result = createTeam(req.user.id, req.body || {});
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(201).json(result);
    } catch { return res.status(500).json({ error: "创建失败" }); }
  });
  app.post("/api/teams/:id/join", requireAuth, (req, res) => {
    try {
      const result = joinTeam(req.params.id, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "加入失败" }); }
  });
  app.post("/api/teams/:id/leave", requireAuth, (req, res) => {
    try {
      const result = leaveTeam(req.params.id, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "退出失败" }); }
  });
}
