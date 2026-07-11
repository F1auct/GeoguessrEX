import crypto from "crypto";
import { db } from "./database.js";

function nowIso() { return new Date().toISOString(); }

export function listMarketBanks(userId) {
  return db.prepare(`
    SELECT b.*, u.username AS owner_username, COUNT(q.id) AS question_count,
      (SELECT COUNT(*) FROM bank_purchases WHERE bank_id=b.id) AS purchase_count
    FROM question_banks b
    LEFT JOIN users u ON u.id=b.owner_user_id
    LEFT JOIN questions q ON q.bank_id=b.id
    WHERE b.is_listed=1 AND b.price>0
    GROUP BY b.id ORDER BY b.updated_at DESC
  `).all().map(row => ({
    id: row.id, title: row.title, price: row.price,
    ownerUsername: row.owner_username || "系统", questionCount: row.question_count,
    purchaseCount: row.purchase_count, isPurchased: userId ? !!db.prepare("SELECT id FROM bank_purchases WHERE bank_id=? AND buyer_id=?").get(row.id, userId) : false,
    isOwner: userId ? row.owner_user_id === userId : false
  }));
}

export function buyBank(bankId, buyerId) {
  const bank = db.prepare("SELECT * FROM question_banks WHERE id=? AND is_listed=1 AND price>0").get(bankId);
  if (!bank) return { error: "题库不存在或不出售", status: 404 };
  if (bank.owner_user_id === buyerId) return { error: "不能购买自己的题库", status: 400 };
  if (db.prepare("SELECT id FROM bank_purchases WHERE bank_id=? AND buyer_id=?").get(bankId, buyerId)) return { error: "已购买过", status: 400 };

  const wallet = db.prepare("SELECT balance_coin FROM wallets WHERE user_id=?").get(buyerId);
  if (!wallet || wallet.balance_coin < bank.price) return { error: "余额不足", status: 400 };

  // 扣款 + 转账（平台抽20%）
  const platformFee = Math.floor(bank.price * 0.2);
  const sellerEarns = bank.price - platformFee;

  db.prepare("UPDATE wallets SET balance_coin=balance_coin-?, updated_at=? WHERE user_id=?").run(bank.price, nowIso(), buyerId);
  db.prepare("UPDATE wallets SET balance_coin=balance_coin+?, updated_at=? WHERE user_id=?").run(sellerEarns, nowIso(), bank.owner_user_id);

  db.prepare("INSERT INTO bank_purchases (id,bank_id,buyer_id,price,created_at) VALUES (?,?,?,?,?)")
    .run(crypto.randomUUID(), bankId, buyerId, bank.price, nowIso());
  return { ok: true, price: bank.price };
}

export function listOwnedBanks(userId) {
  return db.prepare(`
    SELECT b.*, bp.created_at AS purchased_at FROM bank_purchases bp
    JOIN question_banks b ON b.id=bp.bank_id WHERE bp.buyer_id=?
    ORDER BY bp.created_at DESC
  `).all(userId).map(row => ({
    id: row.id, title: row.title, purchasedAt: row.purchased_at
  }));
}
