import crypto from "crypto";
import { db } from "./database.js";
import { createNotification } from "./notificationService.js";

function nowIso() { return new Date().toISOString(); }

// ── 评论 ──
export function addComment({ targetType, targetId, userId, content, parentId }) {
  if (!content?.trim()) return { error: "评论不能为空", status: 400 };
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO comments (id, target_type, target_id, user_id, content, parent_id, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, targetType, targetId, userId, content.trim(), parentId || null, nowIso());
  return { comment: getCommentById(id) };
}

export function getComments(targetType, targetId) {
  return db.prepare(`
    SELECT c.*, u.username FROM comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.target_type=? AND c.target_id=? AND c.parent_id IS NULL
    ORDER BY c.created_at ASC
  `).all(targetType, targetId).map(row => ({
    id: row.id, content: row.content, username: row.username, userId: row.user_id,
    createdAt: row.created_at,
    replies: db.prepare("SELECT c.*, u.username FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.parent_id=? ORDER BY c.created_at ASC").all(row.id).map(r => ({
      id: r.id, content: r.content, username: r.username, userId: r.user_id, createdAt: r.created_at, parentId: r.parent_id
    }))
  }));
}

function getCommentById(id) {
  const row = db.prepare("SELECT c.*, u.username FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=?").get(id);
  return row ? { id: row.id, content: row.content, username: row.username, userId: row.user_id, createdAt: row.created_at, parentId: row.parent_id } : null;
}

// ── 点赞 ──
export function toggleLike({ targetType, targetId, userId }) {
  const existing = db.prepare("SELECT id FROM likes WHERE target_type=? AND target_id=? AND user_id=?").get(targetType, targetId, userId);
  if (existing) {
    db.prepare("DELETE FROM likes WHERE id=?").run(existing.id);
    return { liked: false, count: countLikes(targetType, targetId) };
  }
  db.prepare("INSERT INTO likes (id, target_type, target_id, user_id, created_at) VALUES (?,?,?,?,?)")
    .run(crypto.randomUUID(), targetType, targetId, userId, nowIso());
  return { liked: true, count: countLikes(targetType, targetId) };
}

export function getLikeStatus(targetType, targetId, userId) {
  const count = countLikes(targetType, targetId);
  const liked = userId ? !!db.prepare("SELECT id FROM likes WHERE target_type=? AND target_id=? AND user_id=?").get(targetType, targetId, userId) : false;
  return { count, liked };
}

function countLikes(targetType, targetId) {
  return db.prepare("SELECT COUNT(*) AS c FROM likes WHERE target_type=? AND target_id=?").get(targetType, targetId).c;
}

// ── 关注 ──
export function toggleFollow(followerId, followingId) {
  if (followerId === followingId) return { error: "不能关注自己", status: 400 };
  const existing = db.prepare("SELECT id FROM follows WHERE follower_id=? AND following_id=?").get(followerId, followingId);
  if (existing) {
    db.prepare("DELETE FROM follows WHERE id=?").run(existing.id);
    return { following: false };
  }
  db.prepare("INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?,?,?,?)")
    .run(crypto.randomUUID(), followerId, followingId, nowIso());
  createNotification({ userId: followingId, type: "new_follower", title: "👤 有人关注了你", body: "你有新的粉丝！", link: `/profile` });
  return { following: true };
}

export function getFollowStatus(followerId, followingId) {
  if (!followerId || !followingId) return { following: false, followerCount: 0, followingCount: 0 };
  const following = !!db.prepare("SELECT id FROM follows WHERE follower_id=? AND following_id=?").get(followerId, followingId);
  const followerCount = db.prepare("SELECT COUNT(*) AS c FROM follows WHERE following_id=?").get(followingId)?.c || 0;
  const followingCount = db.prepare("SELECT COUNT(*) AS c FROM follows WHERE follower_id=?").get(followingId)?.c || 0;
  return { following, followerCount, followingCount };
}

export function deleteComment(commentId, userId) {
  const c = db.prepare("SELECT * FROM comments WHERE id=?").get(commentId);
  if (!c) return { error: "评论不存在", status: 404 };
  if (c.user_id !== userId) return { error: "只能删除自己的评论", status: 403 };
  db.prepare("DELETE FROM comments WHERE id=?").run(commentId);
  return { ok: true };
}
