import crypto from "crypto";
import { db } from "./database.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { scoreFromDistance } from "../utils/scoring.js";
import { deductForBounty, getBalance, refundBountyCreator, rewardBountyWinner } from "./walletService.js";
import { createNotification } from "./notificationService.js";
import { addXP } from "./xpService.js";
import { addSeasonXP } from "./seasonService.js";

const BOUNTY_WIN_THRESHOLD = 4000;

function nowIso() {
  return new Date().toISOString();
}

function bountyRowToPublic(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    rewardCoin: row.reward_coin,
    deadline: row.deadline,
    status: row.status,
    winnerId: row.winner_id,
    creatorId: row.creator_id,
    creatorUsername: row.creator_username || "未知用户",
    questionData: safeParseJson(row.question_data),
    createdAt: row.created_at
  };
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function createBounty(userId, { title, description, rewardCoin, deadline, questionData }) {
  if (!title || typeof title !== "string" || !title.trim()) {
    return { error: "悬赏标题必填", status: 400 };
  }
  if (!Number.isInteger(rewardCoin) || rewardCoin <= 0) {
    return { error: "赏金必须为正整数", status: 400 };
  }
  if (!deadline || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deadline)) {
    return { error: "截止时间格式无效", status: 400 };
  }
  if (new Date(deadline).getTime() <= Date.now()) {
    return { error: "截止时间必须在未来", status: 400 };
  }

  const wallet = getBalance(userId);
  if (wallet.balanceCoin < rewardCoin) {
    return { error: "余额不足，无法创建悬赏", status: 400 };
  }

  const questionPayload = questionData && typeof questionData === "object" ? questionData : {};
  if (
    typeof questionPayload.lat !== "number" ||
    typeof questionPayload.lng !== "number"
  ) {
    return { error: "题目坐标数据无效", status: 400 };
  }

  const bountyId = crypto.randomUUID();

  const deductResult = deductForBounty(userId, rewardCoin, bountyId);
  if (deductResult.error) {
    return { error: deductResult.error, status: deductResult.status };
  }

  db.prepare(`
    INSERT INTO bounties (id, creator_id, title, description, reward_coin, deadline, question_data, status, winner_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?)
  `).run(bountyId, userId, title.trim(), description?.trim() ?? "", rewardCoin, deadline, JSON.stringify(questionPayload), nowIso());

  return { bounty: getBountyById(bountyId) };
}

export function getBountyById(bountyId) {
  const row = db.prepare(`
    SELECT b.*, u.username AS creator_username
    FROM bounties b
    LEFT JOIN users u ON u.id = b.creator_id
    WHERE b.id = ?
  `).get(bountyId);

  if (!row) {
    return null;
  }

  // 自动检查是否过期
  if (row.status === "active" && new Date(row.deadline).getTime() <= Date.now()) {
    db.prepare("UPDATE bounties SET status = 'expired' WHERE id = ?").run(row.id);
    row.status = "expired";
    // 过期退款
    refundBountyCreator(row.creator_id, row.reward_coin, row.id);
  }

  return bountyRowToPublic(row);
}

export function listBounties({ status } = {}) {
  const params = [];
  let where = "";

  if (status && ["active", "closed", "expired"].includes(status)) {
    where = "WHERE b.status = ?";
    params.push(status);
  }

  const rows = db.prepare(`
    SELECT b.*, u.username AS creator_username
    FROM bounties b
    LEFT JOIN users u ON u.id = b.creator_id
    ${where}
    ORDER BY b.created_at DESC
  `).all(...params);

  // 过期检查
  const now = Date.now();
  for (const row of rows) {
    if (row.status === "active" && new Date(row.deadline).getTime() <= now) {
      db.prepare("UPDATE bounties SET status = 'expired' WHERE id = ?").run(row.id);
      row.status = "expired";
      refundBountyCreator(row.creator_id, row.reward_coin, row.id);
    }
  }

  return rows.map(bountyRowToPublic);
}

export function submitBountyAnswer(bountyId, userId, guess) {
  const bounty = db.prepare(`
    SELECT b.*, u.username AS creator_username
    FROM bounties b
    LEFT JOIN users u ON u.id = b.creator_id
    WHERE b.id = ?
  `).get(bountyId);

  if (!bounty) {
    return { error: "悬赏不存在", status: 404 };
  }

  if (bounty.status !== "active") {
    return { error: "该悬赏已结束", status: 400 };
  }

  if (new Date(bounty.deadline).getTime() <= Date.now()) {
    db.prepare("UPDATE bounties SET status = 'expired' WHERE id = ?").run(bountyId);
    refundBountyCreator(bounty.creator_id, bounty.reward_coin, bountyId);
    return { error: "悬赏已过期", status: 400 };
  }

  if (bounty.creator_id === userId) {
    return { error: "不能回答自己创建的悬赏", status: 400 };
  }

  if (
    typeof guess?.lat !== "number" ||
    typeof guess?.lng !== "number" ||
    Number.isNaN(guess.lat) ||
    Number.isNaN(guess.lng)
  ) {
    return { error: "答案坐标无效", status: 400 };
  }

  const questionData = safeParseJson(bounty.question_data);
  const distanceKm = haversineDistanceKm(guess.lat, guess.lng, questionData.lat, questionData.lng);
  const score = scoreFromDistance(distanceKm);

  const subId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO bounty_submissions (id, bounty_id, user_id, guess_lat, guess_lng, distance_km, score, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(subId, bountyId, userId, guess.lat, guess.lng, distanceKm, score, nowIso());

  const won = score >= BOUNTY_WIN_THRESHOLD;
  addXP(userId, won ? 50 : 5);
  addSeasonXP(userId, won ? 80 : 15);
  if (won) {
    db.prepare("UPDATE bounties SET status = 'closed', winner_id = ? WHERE id = ?").run(userId, bountyId);
    rewardBountyWinner(userId, bounty.reward_coin, bountyId);
    createNotification({ userId, type: "bounty_won", title: "🎉 你赢得了一笔悬赏！", body: `在悬赏「${bounty.title}」中获胜，获得 ${bounty.reward_coin} 金币`, link: `/bounties/${bountyId}` });
    createNotification({ userId: bounty.creator_id, type: "bounty_answered", title: "📬 你的悬赏被答对了", body: `用户已找到目标位置，悬赏「${bounty.title}」已结束`, link: `/bounties/${bountyId}` });
  } else {
    createNotification({ userId: bounty.creator_id, type: "bounty_submission", title: "📨 有人提交了悬赏答案", body: `悬赏「${bounty.title}」收到新的提交`, link: `/bounties/${bountyId}` });
  }

  return {
    submission: {
      id: subId,
      bountyId,
      userId,
      guessLat: guess.lat,
      guessLng: guess.lng,
      distanceKm,
      score,
      won,
      submittedAt: nowIso()
    }
  };
}

export function closeBounty(bountyId, userId) {
  const bounty = db.prepare("SELECT * FROM bounties WHERE id = ?").get(bountyId);
  if (!bounty) {
    return { error: "悬赏不存在", status: 404 };
  }
  if (bounty.creator_id !== userId) {
    return { error: "只有发布者可以关闭悬赏", status: 403 };
  }
  if (bounty.status !== "active") {
    return { error: "该悬赏已结束", status: 400 };
  }

  db.prepare("UPDATE bounties SET status = 'closed' WHERE id = ?").run(bountyId);
  refundBountyCreator(userId, bounty.reward_coin, bountyId);

  return { bounty: getBountyById(bountyId) };
}

export function getBountySubmissions(bountyId, userId) {
  const bounty = db.prepare("SELECT creator_id FROM bounties WHERE id = ?").get(bountyId);
  if (!bounty) {
    return { error: "悬赏不存在", status: 404 };
  }

  // 只有创建者可以查看所有提交
  const rows = db.prepare(`
    SELECT bs.*, u.username AS username
    FROM bounty_submissions bs
    LEFT JOIN users u ON u.id = bs.user_id
    WHERE bs.bounty_id = ?
    ORDER BY bs.submitted_at ASC
  `).all(bountyId);

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username || "未知用户",
      guessLat: row.guess_lat,
      guessLng: row.guess_lng,
      distanceKm: row.distance_km,
      score: row.score,
      submittedAt: row.submitted_at
    }))
  };
}
