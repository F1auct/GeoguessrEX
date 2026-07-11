import { getLeaderboard } from "../services/leaderboardService.js";

export function registerLeaderboardRoutes(app) {
  app.get("/api/leaderboard", (req, res) => {
    try {
      const { type = "score", period = "all" } = req.query;
      const items = getLeaderboard({ type, period });
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取排行榜失败" });
    }
  });
}
