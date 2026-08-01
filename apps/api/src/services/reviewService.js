import crypto from "crypto";
import { db } from "./database.js";

function nowIso() {
  return new Date().toISOString();
}

export function listPendingReviews() {
  const pendingGames = db.prepare(`
    SELECT g.*, u.username AS creator_username
    FROM treasure_games g
    LEFT JOIN users u ON u.id = g.creator_id
    WHERE g.status = 'pending_review'
    ORDER BY g.created_at ASC
  `).all();

  const pendingPosts = db.prepare(`
    SELECT p.*, u.username AS author_username
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.status = 'pending_review'
    ORDER BY p.created_at ASC
  `).all();

  return {
    items: [
      ...pendingGames.map((row) => ({
        targetType: "game",
        targetId: row.id,
        title: row.title,
        creatorUsername: row.creator_username || "未知用户",
        gameType: row.game_type,
        createdAt: row.created_at
      })),
      ...pendingPosts.map((row) => ({
        targetType: "community_post",
        targetId: row.id,
        title: row.title,
        authorUsername: row.author_username || "未知用户",
        category: row.category,
        createdAt: row.created_at
      }))
    ]
  };
}

export function performReview(reviewerId, { targetType, targetId, action, reason }) {
  if (!["approve", "reject"].includes(action)) {
    return { error: "审核动作无效", status: 400 };
  }
  if (!["game", "community_post"].includes(targetType)) {
    return { error: "审核目标类型无效", status: 400 };
  }
  if (action === "reject" && (!reason || typeof reason !== "string" || !reason.trim())) {
    return { error: "拒绝通过必须注明原因", status: 400 };
  }

  const ts = nowIso();

  if (targetType === "game") {
    const game = db.prepare("SELECT * FROM treasure_games WHERE id = ?").get(targetId);
    if (!game) {
      return { error: "游戏不存在", status: 404 };
    }
    if (game.status !== "pending_review") {
      return { error: "该游戏已审核", status: 400 };
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    db.prepare(`
      UPDATE treasure_games
      SET status = ?, reviewed_by = ?, review_reason = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, reviewerId, (reason || "").trim(), ts, ts, targetId);
  } else {
    const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(targetId);
    if (!post) {
      return { error: "帖子不存在", status: 404 };
    }
    if (post.status !== "pending_review") {
      return { error: "该帖子已审核", status: 400 };
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    db.prepare(`
      UPDATE community_posts
      SET status = ?, reviewed_by = ?, review_reason = ?, reviewed_at = ?
      WHERE id = ?
    `).run(newStatus, reviewerId, (reason || "").trim(), ts, targetId);
  }

  const reviewId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO reviews (id, target_type, target_id, reviewer_id, action, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(reviewId, targetType, targetId, reviewerId, action, (reason || "").trim(), ts);

  return {
    review: {
      id: reviewId,
      targetType,
      targetId,
      action,
      reason: (reason || "").trim(),
      createdAt: ts
    }
  };
}

export function revokeReview(reviewerId, { targetType, targetId, reason }) {
  if (!["game", "community_post"].includes(targetType)) {
    return { error: "审核目标类型无效", status: 400 };
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return { error: "撤销审核必须注明原因", status: 400 };
  }

  const ts = nowIso();

  if (targetType === "game") {
    const game = db.prepare("SELECT * FROM treasure_games WHERE id = ?").get(targetId);
    if (!game) {
      return { error: "游戏不存在", status: 404 };
    }
    if (game.status === "pending_review" || game.status === "revoked") {
      return { error: "该游戏尚未审核或已被撤销，无法撤销", status: 400 };
    }

    db.prepare(`
      UPDATE treasure_games
      SET status = 'revoked', reviewed_by = NULL, review_reason = NULL, reviewed_at = NULL, updated_at = ?
      WHERE id = ?
    `).run(ts, targetId);
  } else {
    const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(targetId);
    if (!post) {
      return { error: "帖子不存在", status: 404 };
    }
    if (post.status === "pending_review" || post.status === "revoked") {
      return { error: "该帖子尚未审核或已被撤销，无法撤销", status: 400 };
    }

    db.prepare(`
      UPDATE community_posts
      SET status = 'revoked', reviewed_by = NULL, review_reason = NULL, reviewed_at = NULL
      WHERE id = ?
    `).run(targetId);
  }

  const reviewId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO reviews (id, target_type, target_id, reviewer_id, action, reason, created_at)
    VALUES (?, ?, ?, ?, 'revoke', ?, ?)
  `).run(reviewId, targetType, targetId, reviewerId, reason.trim(), ts);

  return {
    review: {
      id: reviewId,
      targetType,
      targetId,
      action: "revoke",
      reason: reason.trim(),
      createdAt: ts
    }
  };
}

export function listRevokedReviews() {
  const revokedGames = db.prepare(`
    SELECT r.*, g.title AS target_title, g.description, g.game_type, g.region,
      g.require_player_info, g.player_info_fields, g.creator_id, g.created_at AS target_created,
      u.username AS creator_username
    FROM reviews r
    LEFT JOIN treasure_games g ON g.id = r.target_id
    LEFT JOIN users u ON u.id = g.creator_id
    WHERE r.target_type = 'game' AND r.action = 'revoke'
    ORDER BY r.created_at DESC
  `).all();

  const revokedPosts = db.prepare(`
    SELECT r.*, p.title AS target_title, p.content, p.category, p.region,
      p.contact_info, p.media_list, p.author_id, p.created_at AS target_created,
      u.username AS author_username
    FROM reviews r
    LEFT JOIN community_posts p ON p.id = r.target_id
    LEFT JOIN users u ON u.id = p.author_id
    WHERE r.target_type = 'community_post' AND r.action = 'revoke'
    ORDER BY r.created_at DESC
  `).all();

  return {
    games: revokedGames.map((row) => {
      const locationTasks = db.prepare("SELECT * FROM location_tasks WHERE game_id = ? ORDER BY order_index ASC").all(row.target_id);
      return {
        reviewId: row.id,
        targetId: row.target_id,
        title: row.target_title || "(已删除)",
        description: row.description || "",
        gameType: row.game_type,
        region: row.region || "",
        requirePlayerInfo: !!row.require_player_info,
        playerInfoFields: safeParseJson(row.player_info_fields),
        creatorId: row.creator_id,
        creatorUsername: row.creator_username || "未知",
        locationTasks: locationTasks.map((t) => ({
          id: t.id, orderIndex: t.order_index, title: t.title,
          description: t.description, arrivalHint: t.arrival_hint,
          nextLocationHint: t.next_location_hint,
          targetLat: t.target_lat, targetLng: t.target_lng,
          taskType: t.task_type, taskConfig: safeParseJson(t.task_config)
        })),
        reason: row.reason,
        revokedAt: row.created_at,
        createdAt: row.target_created
      };
    }),
    posts: revokedPosts.map((row) => ({
      reviewId: row.id,
      targetId: row.target_id,
      title: row.target_title || "(已删除)",
      content: row.content || "",
      category: row.category,
      region: row.region || "",
      contactInfo: row.contact_info || "",
      mediaList: safeParseJson(row.media_list),
      authorId: row.author_id,
      authorUsername: row.author_username || "未知",
      reason: row.reason,
      revokedAt: row.created_at,
      createdAt: row.target_created
    }))
  };
}

function safeParseJson(value) {
  try { return JSON.parse(value); } catch { return []; }
}
