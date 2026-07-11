import { requireAuth } from "../middleware/auth.js";
import { addComment, deleteComment, getComments, getFollowStatus, getLikeStatus, toggleFollow, toggleLike } from "../services/socialService.js";

export function registerSocialRoutes(app) {
  // 评论
  app.get("/api/comments/:targetType/:targetId", (req, res) => {
    try { return res.json({ items: getComments(req.params.targetType, req.params.targetId) }); }
    catch { return res.status(500).json({ error: "获取评论失败" }); }
  });
  app.post("/api/comments", requireAuth, (req, res) => {
    try {
      const result = addComment({ ...req.body, userId: req.user.id });
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(201).json(result);
    } catch { return res.status(500).json({ error: "评论失败" }); }
  });
  app.delete("/api/comments/:id", requireAuth, (req, res) => {
    try {
      const result = deleteComment(req.params.id, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(204).end();
    } catch { return res.status(500).json({ error: "删除失败" }); }
  });

  // 点赞
  app.get("/api/likes/:targetType/:targetId", requireAuth, (req, res) => {
    try { return res.json(getLikeStatus(req.params.targetType, req.params.targetId, req.user.id)); }
    catch { return res.status(500).json({ error: "获取点赞状态失败" }); }
  });
  app.post("/api/likes", requireAuth, (req, res) => {
    try { return res.json(toggleLike({ ...req.body, userId: req.user.id })); }
    catch { return res.status(500).json({ error: "点赞失败" }); }
  });

  // 关注
  app.post("/api/follows", requireAuth, (req, res) => {
    try {
      const result = toggleFollow(req.user.id, req.body.followingId);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "关注失败" }); }
  });
  app.get("/api/follows/:userId", requireAuth, (req, res) => {
    try { return res.json(getFollowStatus(req.user.id, req.params.userId)); }
    catch { return res.status(500).json({ error: "获取关注状态失败" }); }
  });
}
