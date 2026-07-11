import crypto from "crypto";
import { db } from "./database.js";

function nowIso() {
  return new Date().toISOString();
}

export function getOrCreateWallet(userId) {
  let wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
  if (!wallet) {
    const ts = nowIso();
    db.prepare("INSERT INTO wallets (user_id, balance_coin, created_at, updated_at) VALUES (?, 0, ?, ?)").run(userId, ts, ts);
    wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
  }
  return wallet;
}

export function getBalance(userId) {
  const wallet = getOrCreateWallet(userId);
  return {
    userId,
    balanceCoin: wallet.balance_coin
  };
}

export function recharge(userId, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "充值金额必须为正整数", status: 400 };
  }

  const wallet = getOrCreateWallet(userId);
  const balanceBefore = wallet.balance_coin;
  const balanceAfter = balanceBefore + amount;
  const ts = nowIso();
  const txnId = crypto.randomUUID();

  db.prepare("UPDATE wallets SET balance_coin = ?, updated_at = ? WHERE user_id = ?").run(balanceAfter, ts, userId);
  db.prepare(`
    INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, reference_id, created_at)
    VALUES (?, ?, 'recharge', ?, ?, ?, NULL, ?)
  `).run(txnId, userId, amount, balanceBefore, balanceAfter, ts);

  return {
    transaction: { id: txnId, type: "recharge", amount, balanceBefore, balanceAfter },
    balanceCoin: balanceAfter
  };
}

export function withdraw(userId, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "提现金额必须为正整数", status: 400 };
  }

  const wallet = getOrCreateWallet(userId);
  if (wallet.balance_coin < amount) {
    return { error: "余额不足", status: 400 };
  }

  const balanceBefore = wallet.balance_coin;
  const balanceAfter = balanceBefore - amount;
  const ts = nowIso();
  const txnId = crypto.randomUUID();

  db.prepare("UPDATE wallets SET balance_coin = ?, updated_at = ? WHERE user_id = ?").run(balanceAfter, ts, userId);
  db.prepare(`
    INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, reference_id, created_at)
    VALUES (?, ?, 'withdraw', ?, ?, ?, NULL, ?)
  `).run(txnId, userId, amount, balanceBefore, balanceAfter, ts);

  return {
    transaction: { id: txnId, type: "withdraw", amount, balanceBefore, balanceAfter },
    balanceCoin: balanceAfter
  };
}

export function getTransactions(userId) {
  const rows = db.prepare(`
    SELECT id, type, amount, balance_before, balance_after, reference_id, created_at
    FROM coin_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userId);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
    referenceId: row.reference_id,
    createdAt: row.created_at
  }));
}

export function deductForBounty(userId, amount, bountyId) {
  const wallet = getOrCreateWallet(userId);
  if (wallet.balance_coin < amount) {
    return { error: "余额不足，无法创建悬赏", status: 400 };
  }

  const balanceBefore = wallet.balance_coin;
  const balanceAfter = balanceBefore - amount;
  const ts = nowIso();
  const txnId = crypto.randomUUID();

  db.prepare("UPDATE wallets SET balance_coin = ?, updated_at = ? WHERE user_id = ?").run(balanceAfter, ts, userId);
  db.prepare(`
    INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, reference_id, created_at)
    VALUES (?, ?, 'bounty_create', ?, ?, ?, ?, ?)
  `).run(txnId, userId, amount, balanceBefore, balanceAfter, bountyId, ts);

  return { ok: true, balanceCoin: balanceAfter };
}

export function rewardBountyWinner(winnerId, amount, bountyId) {
  const wallet = getOrCreateWallet(winnerId);
  const balanceBefore = wallet.balance_coin;
  const balanceAfter = balanceBefore + amount;
  const ts = nowIso();
  const txnId = crypto.randomUUID();

  db.prepare("UPDATE wallets SET balance_coin = ?, updated_at = ? WHERE user_id = ?").run(balanceAfter, ts, winnerId);
  db.prepare(`
    INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, reference_id, created_at)
    VALUES (?, ?, 'bounty_reward', ?, ?, ?, ?, ?)
  `).run(txnId, winnerId, amount, balanceBefore, balanceAfter, bountyId, ts);

  return { ok: true, balanceCoin: balanceAfter };
}

export function refundBountyCreator(creatorId, amount, bountyId) {
  const wallet = getOrCreateWallet(creatorId);
  const balanceBefore = wallet.balance_coin;
  const balanceAfter = balanceBefore + amount;
  const ts = nowIso();
  const txnId = crypto.randomUUID();

  db.prepare("UPDATE wallets SET balance_coin = ?, updated_at = ? WHERE user_id = ?").run(balanceAfter, ts, creatorId);
  db.prepare(`
    INSERT INTO coin_transactions (id, user_id, type, amount, balance_before, balance_after, reference_id, created_at)
    VALUES (?, ?, 'bounty_refund', ?, ?, ?, ?, ?)
  `).run(txnId, creatorId, amount, balanceBefore, balanceAfter, bountyId, ts);

  return { ok: true, balanceCoin: balanceAfter };
}
