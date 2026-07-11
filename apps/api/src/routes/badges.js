import { requireAuth } from "../middleware/auth.js";
import { getUserBadges } from "../services/badgeService.js";

export function registerBadgeRoutes(app) {
  app.get("/api/badges/me", requireAuth, (req, res) => {
    try {
      const result = getUserBadges(req.user.id);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取徽章失败" });
    }
  });

  app.get("/api/badges/:userId", (req, res) => {
    try {
      const result = getUserBadges(req.params.userId);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取徽章失败" });
    }
  });
}
