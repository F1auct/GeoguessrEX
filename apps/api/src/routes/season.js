import { requireAuth } from "../middleware/auth.js";
import { getCurrentSeason, getSeasonLeaderboard, getUserPass } from "../services/seasonService.js";

export function registerSeasonRoutes(app) {
  app.get("/api/season", (req, res) => {
    try { return res.json(getCurrentSeason()); }
    catch { return res.status(500).json({ error: "获取赛季失败" }); }
  });
  app.get("/api/season/pass", requireAuth, (req, res) => {
    try { return res.json(getUserPass(req.user.id)); }
    catch { return res.status(500).json({ error: "获取通行证失败" }); }
  });
  app.get("/api/season/leaderboard", (req, res) => {
    try { return res.json({ items: getSeasonLeaderboard() }); }
    catch { return res.status(500).json({ error: "获取排行榜失败" }); }
  });
}
