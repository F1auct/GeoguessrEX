import { requireAuth } from "../middleware/auth.js";
import { getBalance, getTransactions, recharge, withdraw } from "../services/walletService.js";

export function registerWalletRoutes(app) {
  app.get("/api/wallet", requireAuth, (req, res) => {
    try {
      const result = getBalance(req.user.id);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "获取余额失败" });
    }
  });

  app.post("/api/wallet/recharge", requireAuth, (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      const result = recharge(req.user.id, amount);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "充值失败" });
    }
  });

  app.post("/api/wallet/withdraw", requireAuth, (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      const result = withdraw(req.user.id, amount);
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "提现失败" });
    }
  });

  app.get("/api/wallet/transactions", requireAuth, (req, res) => {
    try {
      const items = getTransactions(req.user.id);
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "获取交易记录失败" });
    }
  });
}
