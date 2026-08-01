import { requireAuth } from "../middleware/auth.js";
import { getUserRank, joinQueue, leaveQueue, findMatch, getQueueStatus, getRankedLeaderboard, getRankedHistory } from "../services/rankedService.js";
import { createRoom, getRoomByCode } from "../services/pvpService.js";
import { resolveRankedMatch } from "../services/rankedService.js";

export function registerRankedRoutes(app) {
  // 获取当前用户排位信息
  app.get("/api/ranked/me", requireAuth, (req, res) => {
    try {
      const rank = getUserRank(req.user.id);
      if (!rank) return res.status(404).json({ error: "用户不存在" });
      return res.json(rank);
    } catch (e) {
      return res.status(500).json({ error: "获取排位信息失败" });
    }
  });

  // 加入匹配队列
  app.post("/api/ranked/queue/join", requireAuth, (req, res) => {
    try {
      const result = joinQueue(req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: "加入队列失败" });
    }
  });

  // 离开匹配队列
  app.post("/api/ranked/queue/leave", requireAuth, (req, res) => {
    try {
      return res.json(leaveQueue(req.user.id));
    } catch (e) {
      return res.status(500).json({ error: "离开队列失败" });
    }
  });

  // 查询匹配状态 + 尝试匹配
  app.get("/api/ranked/queue/status", requireAuth, (req, res) => {
    try {
      const status = getQueueStatus(req.user.id);
      let match = null;
      if (status.inQueue) {
        match = findMatch(req.user.id);
      }
      return res.json({ ...status, match });
    } catch (e) {
      return res.status(500).json({ error: "查询失败" });
    }
  });

  // 排位排行榜
  app.get("/api/ranked/leaderboard", (req, res) => {
    try {
      return res.json({ items: getRankedLeaderboard(50) });
    } catch (e) {
      return res.status(500).json({ error: "获取排行榜失败" });
    }
  });

  // 排位赛历史
  app.get("/api/ranked/history", requireAuth, (req, res) => {
    try {
      return res.json({ items: getRankedHistory(req.user.id, 20) });
    } catch (e) {
      return res.status(500).json({ error: "获取历史失败" });
    }
  });

  // 排位赛房间创建（复用PvP房间；带 botId 时创建人机对战房间）
  app.post("/api/ranked/create-room", requireAuth, (req, res) => {
    try {
      const room = createRoom(req.user.id, req.body.maxRounds || 5, {
        isRanked: true,
        botId: req.body.botId || null,
      });
      return res.json(room);
    } catch (e) {
      return res.status(500).json({ error: "创建房间失败" });
    }
  });

  // 排位赛结算
  app.post("/api/ranked/resolve", requireAuth, (req, res) => {
    try {
      const { winnerId, loserId, roomCode } = req.body;
      if (!winnerId || !loserId) return res.status(400).json({ error: "缺少胜负方信息" });

      const room = getRoomByCode(roomCode);
      const result = resolveRankedMatch(winnerId, loserId, room?.id || null);
      if (result.error) return res.status(400).json({ error: result.error });

      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: "结算失败" });
    }
  });
}
