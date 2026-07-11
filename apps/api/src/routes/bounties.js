import { requireAuth } from "../middleware/auth.js";
import {
  closeBounty,
  createBounty,
  getBountyById,
  getBountySubmissions,
  listBounties,
  submitBountyAnswer
} from "../services/bountyService.js";

export function registerBountyRoutes(app) {
  // 创建悬赏
  app.post("/api/bounties", requireAuth, (req, res) => {
    try {
      const result = createBounty(req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: "创建悬赏失败" });
    }
  });

  // 悬赏列表
  app.get("/api/bounties", (req, res) => {
    try {
      const status = req.query.status;
      const items = listBounties({ status });
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取悬赏列表失败" });
    }
  });

  // 悬赏详情
  app.get("/api/bounties/:id", (req, res) => {
    try {
      const bounty = getBountyById(req.params.id);
      if (!bounty) {
        return res.status(404).json({ error: "悬赏不存在" });
      }
      return res.json(bounty);
    } catch (err) {
      return res.status(500).json({ error: "获取悬赏详情失败" });
    }
  });

  // 提交答案
  app.post("/api/bounties/:id/submit", requireAuth, (req, res) => {
    try {
      const result = submitBountyAnswer(req.params.id, req.user.id, req.body?.guess);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "提交答案失败" });
    }
  });

  // 查看提交记录（发布者）
  app.get("/api/bounties/:id/submissions", requireAuth, (req, res) => {
    try {
      const result = getBountySubmissions(req.params.id, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取提交记录失败" });
    }
  });

  // 关闭悬赏
  app.post("/api/bounties/:id/close", requireAuth, (req, res) => {
    try {
      const result = closeBounty(req.params.id, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "关闭悬赏失败" });
    }
  });
}
