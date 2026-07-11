import { requireAuth } from "../middleware/auth.js";
import { createPost, deletePost, getPostById, listMyPosts, listPosts } from "../services/communityService.js";

export function registerCommunityRoutes(app) {
  // 发布帖子
  app.post("/api/community", requireAuth, (req, res) => {
    try {
      const result = createPost(req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ error: "发布帖子失败" });
    }
  });

  // 帖子列表（公开，只展示已批准的）
  app.get("/api/community", (req, res) => {
    try {
      const { category, region, status } = req.query;
      const items = listPosts({ category, region, status });
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取帖子列表失败" });
    }
  });

  // 我的帖子
  app.get("/api/community/my", requireAuth, (req, res) => {
    try {
      const items = listMyPosts(req.user.id);
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取我的帖子失败" });
    }
  });

  // 帖子详情
  app.get("/api/community/:id", (req, res) => {
    try {
      const post = getPostById(req.params.id);
      if (!post) {
        return res.status(404).json({ error: "帖子不存在" });
      }
      return res.json(post);
    } catch (err) {
      return res.status(500).json({ error: "获取帖子详情失败" });
    }
  });

  // 删除帖子
  app.delete("/api/community/:id", requireAuth, (req, res) => {
    try {
      const result = deletePost(req.params.id, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ error: "删除帖子失败" });
    }
  });
}
