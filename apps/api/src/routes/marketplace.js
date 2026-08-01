import { requireAuth } from "../middleware/auth.js";
import { buyBank, listMarketBanks, listOwnedBanks } from "../services/marketplaceService.js";
import { db } from "../services/database.js";

export function registerMarketplaceRoutes(app) {
  app.get("/api/marketplace", requireAuth, (req, res) => {
    try { return res.json({ items: listMarketBanks(req.user.id) }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.post("/api/marketplace/buy", requireAuth, (req, res) => {
    try {
      const result = buyBank(req.body.bankId, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "购买失败" }); }
  });

  app.put("/api/groups/:id/list", requireAuth, (req, res) => {
    try {
      const { price } = req.body || {};
      const bank = db.prepare("SELECT * FROM question_banks WHERE id=?").get(req.params.id);
      if (!bank) return res.status(404).json({ error: "题库不存在" });
      if (bank.owner_user_id !== req.user.id) return res.status(403).json({ error: "无权限" });
      db.prepare("UPDATE question_banks SET price=?, is_listed=? WHERE id=?").run(price || 0, price > 0 ? 1 : 0, req.params.id);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: "操作失败" }); }
  });

  app.get("/api/marketplace/owned", requireAuth, (req, res) => {
    try { return res.json({ items: listOwnedBanks(req.user.id) }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });
}
