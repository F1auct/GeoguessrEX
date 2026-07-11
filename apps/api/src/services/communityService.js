import crypto from "crypto";
import { db } from "./database.js";
import { addXP } from "./xpService.js";

function nowIso() {
  return new Date().toISOString();
}

const VALID_CATEGORIES = ["lost_item", "found_item", "missing_person", "announcement", "other"];

export function createPost(userId, payload) {
  const { title, content, category, region, contactInfo, mediaList } = payload || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return { error: "标题必填", status: 400 };
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return { error: "分类无效", status: 400 };
  }
  const textContent = (content || "").trim();
  const mediaArr = Array.isArray(mediaList) ? mediaList : [];
  if (!textContent && mediaArr.length === 0) {
    return { error: "内容或媒体素材至少填写一项", status: 400 };
  }

  const postId = crypto.randomUUID();
  const ts = nowIso();

  db.prepare(`
    INSERT INTO community_posts (
      id, author_id, title, content, category, region, contact_info, media_list, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)
  `).run(
    postId, userId, title.trim(), textContent,
    category, (region || "").trim(), (contactInfo || "").trim(),
    JSON.stringify(mediaArr), ts
  );

  addXP(userId, 20);
  return { post: getPostById(postId) };
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function postRowToPublic(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    region: row.region,
    contactInfo: row.contact_info,
    mediaList: safeParseJson(row.media_list || "[]"),
    status: row.status,
    authorId: row.author_id,
    authorUsername: row.author_username || "未知用户",
    reviewedBy: row.reviewed_by,
    reviewReason: row.review_reason,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at
  };
}

export function getPostById(postId) {
  const row = db.prepare(`
    SELECT p.*, u.username AS author_username
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.id = ?
  `).get(postId);

  return row ? postRowToPublic(row) : null;
}

export function listPosts({ category, region, status } = {}) {
  const conditions = [];
  const params = [];

  // 默认只展示已批准的帖子（未登录用户也只能看到已批准的）
  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  } else {
    conditions.push("p.status = 'approved'");
  }

  if (category) {
    conditions.push("p.category = ?");
    params.push(category);
  }
  if (region) {
    conditions.push("p.region = ?");
    params.push(region);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const rows = db.prepare(`
    SELECT p.*, u.username AS author_username
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.author_id
    ${where}
    ORDER BY p.created_at DESC
  `).all(...params);

  return rows.map(postRowToPublic);
}

export function listMyPosts(userId) {
  const rows = db.prepare(`
    SELECT p.*, u.username AS author_username
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.author_id = ?
    ORDER BY p.created_at DESC
  `).all(userId);

  return rows.map(postRowToPublic);
}

export function deletePost(postId, userId) {
  const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(postId);
  if (!post) {
    return { error: "帖子不存在", status: 404 };
  }
  if (post.author_id !== userId) {
    return { error: "只能删除自己的帖子", status: 403 };
  }

  db.prepare("DELETE FROM community_posts WHERE id = ?").run(postId);
  return { ok: true };
}
