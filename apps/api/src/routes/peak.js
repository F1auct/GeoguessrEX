import { requireAuth } from "../middleware/auth.js";
import { checkPeakEligibility, isPeakOpen, joinPeakQueue, leavePeakQueue, findPeakMatch, getPeakQueueStatus, getPeakLeaderboard, getPeakHistory } from "../services/peakService.js";
import { createRoom, getRoomByCode } from "../services/pvpService.js";

export function registerPeakRoutes(app) {
  // 检查资格
  app.get("/api/peak/eligibility", requireAuth, (req, res) => {
    try {
      return res.json({ ...checkPeakEligibility(req.user.id), isOpen: isPeakOpen() });
    } catch (e) {
      return res.status(500).json({ error: "检查失败" });
    }
  });

  // 加入队列
  app.post("/api/peak/queue/join", requireAuth, (req, res) => {
    try {
      const result = joinPeakQueue(req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: "加入失败" });
    }
  });

  // 离开队列
  app.post("/api/peak/queue/leave", requireAuth, (req, res) => {
    try { return res.json(leavePeakQueue(req.user.id)); }
    catch { return res.status(500).json({ error: "离开失败" }); }
  });

  // 队列状态+尝试匹配
  app.get("/api/peak/queue/status", requireAuth, (req, res) => {
    try {
      const status = getPeakQueueStatus(req.user.id);
      let match = null;
      if (status.inQueue) match = findPeakMatch(req.user.id);
      return res.json({ ...status, match });
    } catch { return res.status(500).json({ error: "查询失败" }); }
  });

  // 排行榜
  app.get("/api/peak/leaderboard", (req, res) => {
    try { return res.json({ items: getPeakLeaderboard(50) }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // 历史
  app.get("/api/peak/history", requireAuth, (req, res) => {
    try { return res.json({ items: getPeakHistory(req.user.id, 20) }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // 创建房间
  app.post("/api/peak/create-room", requireAuth, (req, res) => {
    try { return res.json(createRoom(req.user.id, 5)); }
    catch { return res.status(500).json({ error: "创建失败" }); }
  });
}
