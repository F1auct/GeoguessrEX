import crypto from "crypto";
import { db } from "./database.js";

function nowIso() { return new Date().toISOString(); }

export function createNotification({ userId, type, title, body, link }) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, type, title, body || "", link || "", nowIso());
  return { id };
}

export function getUserNotifications(userId) {
  return db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(userId).map(row => ({
    id: row.id, type: row.type, title: row.title,
    body: row.body, link: row.link,
    isRead: !!row.is_read, createdAt: row.created_at
  }));
}

export function getUnreadCount(userId) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0").get(userId);
  return row?.c || 0;
}

export function markRead(userId, notificationId) {
  if (notificationId === "all") {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(userId);
  } else {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(notificationId, userId);
  }
  return { ok: true };
}
