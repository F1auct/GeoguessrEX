import { requireAuth } from "../middleware/auth.js";
import { getCheckinStreak, getDailyLeaderboard, getMyTodaySubmissions, getOrCreateTodayChallenge, submitDailyAnswer } from "../services/dailyChallengeService.js";
import { getLevelInfo } from "../services/xpService.js";

export function registerDailyRoutes(app) {
  app.get("/api/daily-challenge", (req, res) => {
    try { return res.json({ questions: getOrCreateTodayChallenge() }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.post("/api/daily-challenge/submit", requireAuth, (req, res) => {
    try {
      const result = submitDailyAnswer(req.user.id, req.body.challengeId, req.body.guess);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "提交失败" }); }
  });

  app.get("/api/daily-challenge/leaderboard", (req, res) => {
    try { return res.json({ items: getDailyLeaderboard(req.query.date) }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.get("/api/daily-challenge/my", requireAuth, (req, res) => {
    try {
      return res.json({ submissions: getMyTodaySubmissions(req.user.id), streak: getCheckinStreak(req.user.id), level: getLevelInfo(req.user.id) });
    } catch { return res.status(500).json({ error: "获取失败" }); }
  });
}
