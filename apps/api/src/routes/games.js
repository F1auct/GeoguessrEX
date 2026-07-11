import { requireAuth } from "../middleware/auth.js";
import {
  approveRegistration,
  completeStep,
  createGame,
  getGameById,
  getGameRegistrations,
  getMyProgress,
  listGames,
  listMyGames,
  registerForGame
} from "../services/treasureGameService.js";

export function registerGameRoutes(app) {
  // 我创建的游戏（必须在 /api/games/:id 之前）
  app.get("/api/games/my", requireAuth, (req, res) => {
    try {
      const items = listMyGames(req.user.id);
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取我的游戏列表失败" });
    }
  });

  // 创建游戏
  app.post("/api/games", requireAuth, (req, res) => {
    try {
      const result = createGame(req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: "创建游戏失败" });
    }
  });

  // 游戏列表（支持筛选）
  app.get("/api/games", (req, res) => {
    try {
      const { region, gameType, status } = req.query;
      const items = listGames({ region, gameType, status });
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取游戏列表失败" });
    }
  });

  // 游戏详情
  app.get("/api/games/:id", (req, res) => {
    try {
      const game = getGameById(req.params.id);
      if (!game) {
        return res.status(404).json({ error: "游戏不存在" });
      }
      return res.json(game);
    } catch (err) {
      return res.status(500).json({ error: "获取游戏详情失败" });
    }
  });

  // 报名
  app.post("/api/games/:id/register", requireAuth, (req, res) => {
    try {
      const result = registerForGame(req.params.id, req.user.id, req.body?.playerInfo || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: "报名失败" });
    }
  });

  // 查看报名列表（游戏发起方）
  app.get("/api/games/:id/registrations", requireAuth, (req, res) => {
    try {
      const result = getGameRegistrations(req.params.id, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取报名列表失败" });
    }
  });

  // 审核报名
  app.put("/api/games/:id/registrations/:regId", requireAuth, (req, res) => {
    try {
      const action = req.body?.action;
      const result = approveRegistration(req.params.id, req.params.regId, action, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "审核报名失败" });
    }
  });

  // 查看我的进度
  app.get("/api/games/:id/progress", requireAuth, (req, res) => {
    try {
      const result = getMyProgress(req.params.id, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取进度失败" });
    }
  });

  // 完成步骤
  app.post("/api/games/:id/progress/complete", requireAuth, (req, res) => {
    try {
      const result = completeStep(req.params.id, req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "完成步骤失败" });
    }
  });
}
