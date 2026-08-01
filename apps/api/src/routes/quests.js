import { requireAuth } from "../middleware/auth.js";
import { getAllQuestProgress, claimQuestReward, trackProgress } from "../services/questService.js";

export function registerQuestRoutes(app) {
  // 获取所有任务及进度
  app.get("/api/quests", requireAuth, (req, res) => {
    try { return res.json(getAllQuestProgress(req.user.id)); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // 领取任务奖励
  app.post("/api/quests/:questId/claim", requireAuth, (req, res) => {
    try {
      const result = claimQuestReward(req.user.id, req.params.questId);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "领取失败" }); }
  });

  // 手动触发进度追踪（用于测试/特定场景；实际进度由各 service 自动追踪）
  app.post("/api/quests/track", requireAuth, (req, res) => {
    try {
      trackProgress(req.user.id, req.body.targetType, req.body.increment || 1);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "追踪失败" }); }
  });
}
