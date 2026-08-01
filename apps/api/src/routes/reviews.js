import { requireAuth, requireRole } from "../middleware/auth.js";
import { listPendingReviews, listRevokedReviews, performReview, revokeReview } from "../services/reviewService.js";
import { db } from "../services/database.js";

export function registerReviewRoutes(app) {
  // 待审核列表（仅 admin）
  app.get("/api/reviews/pending", requireAuth, requireRole("admin"), (req, res) => {
    try {
      const result = listPendingReviews();
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取待审核列表失败" });
    }
  });

  // 执行审核（仅 admin）
  app.post("/api/reviews", requireAuth, requireRole("admin"), (req, res) => {
    try {
      const { targetType, targetId, action, reason } = req.body || {};
      const result = performReview(req.user.id, { targetType, targetId, action, reason });
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: "审核失败" });
    }
  });

  // 组织认证列表 + 审核
  app.get("/api/orgs/pending", requireAuth, requireRole("admin"), (req, res) => {
    try {
      const rows = db.prepare("SELECT id, username, org_name, created_at FROM users WHERE org_name != '' AND org_verified = 0 ORDER BY created_at ASC").all();
      return res.json({ items: rows });
    } catch { return res.status(500).json({ error: "获取失败" }); }
  });
  app.post("/api/orgs/verify", requireAuth, requireRole("admin"), (req, res) => {
    try {
      const { userId } = req.body || {};
      db.prepare("UPDATE users SET org_verified = 1 WHERE id = ?").run(userId);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "认证失败" }); }
  });

  // 已撤销列表（仅 admin）
  app.get("/api/reviews/revoked", requireAuth, requireRole("admin"), (req, res) => {
    try {
      const result = listRevokedReviews();
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取已撤销列表失败" });
    }
  });

  // 撤销审核（仅 admin）
  app.post("/api/reviews/revoke", requireAuth, requireRole("admin"), (req, res) => {
    try {
      const { targetType, targetId, reason } = req.body || {};
      const result = revokeReview(req.user.id, { targetType, targetId, reason });
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "撤销审核失败" });
    }
  });
}
