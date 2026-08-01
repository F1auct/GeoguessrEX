import { requireAuth } from "../middleware/auth.js";
import { getUnreadCount, getUserNotifications, markRead } from "../services/notificationService.js";

export function registerNotificationRoutes(app) {
  app.get("/api/notifications", requireAuth, (req, res) => {
    try {
      const items = getUserNotifications(req.user.id);
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取通知失败" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, (req, res) => {
    try {
      const count = getUnreadCount(req.user.id);
      return res.json({ count });
    } catch (err) {
      return res.status(500).json({ error: "获取未读数失败" });
    }
  });

  app.post("/api/notifications/mark-read", requireAuth, (req, res) => {
    try {
      const id = req.body?.id || "all";
      const result = markRead(req.user.id, id);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "标记已读失败" });
    }
  });
}
