import { requireAuth } from "../middleware/auth.js";
import { listRoutes, getRouteById, startRoute, getProgress, listMyProgress, submitStopAnswer } from "../services/routeService.js";

export function registerRouteRoutes(app) {
  // 列出所有活跃路线
  app.get("/api/routes", (req, res) => {
    try {
      return res.json({ items: listRoutes() });
    } catch (e) {
      return res.status(500).json({ error: "获取路线列表失败" });
    }
  });

  // 获取单条路线详情
  app.get("/api/routes/:id", (req, res) => {
    try {
      const route = getRouteById(req.params.id);
      if (!route) return res.status(404).json({ error: "路线不存在" });
      return res.json(route);
    } catch (e) {
      return res.status(500).json({ error: "获取路线详情失败" });
    }
  });

  // 开始/恢复路线
  app.post("/api/routes/:id/start", requireAuth, (req, res) => {
    try {
      const result = startRoute(req.user.id, req.params.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: "开始路线失败" });
    }
  });

  // 获取路线进度
  app.get("/api/routes/:id/progress", requireAuth, (req, res) => {
    try {
      const progress = getProgress(req.user.id, req.params.id);
      if (!progress) return res.json({ started: false });
      return res.json(progress);
    } catch (e) {
      return res.status(500).json({ error: "获取进度失败" });
    }
  });

  // 获取我的所有路线进度
  app.get("/api/routes/my/progress", requireAuth, (req, res) => {
    try {
      return res.json({ items: listMyProgress(req.user.id) });
    } catch (e) {
      return res.status(500).json({ error: "获取路线进度失败" });
    }
  });

  // 提交当前站点猜测
  app.post("/api/routes/:id/submit", requireAuth, (req, res) => {
    try {
      const result = submitStopAnswer(req.user.id, req.params.id, req.body.guess);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: "提交失败" });
    }
  });
}
