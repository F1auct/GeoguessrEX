import crypto from "crypto";
import { db } from "./database.js";

function nowIso() {
  return new Date().toISOString();
}

function canEditBank(user, bank) {
  return user?.role === "admin" || (user?.id && bank?.owner_user_id === user.id);
}

function bankRowToGroup(row, user) {
  return {
    id: row.id,
    title: row.title,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username || "系统",
    count: row.question_count ?? 0,
    canEdit: canEditBank(user, row),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function questionRowToQuestion(row, user) {
  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    sourceType: row.source_type,
    imageUrl: row.image_path,
    groupId: row.bank_id,
    groupTitle: row.bank_title,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username || "系统",
    canEdit: canEditBank(user, row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    streetView: {
      lat: row.lat,
      lng: row.lng,
      heading: row.heading,
      pitch: row.pitch,
      fov: row.fov,
      panoId: row.pano_id ?? null
    }
  };

  return base;
}

function getBankRow(groupId) {
  return db
    .prepare(`
      SELECT b.*, u.username AS owner_username
      FROM question_banks b
      LEFT JOIN users u ON u.id = b.owner_user_id
      WHERE b.id = ?
    `)
    .get(groupId);
}

function getQuestionRow(questionId) {
  return db
    .prepare(`
      SELECT q.*, b.title AS bank_title, b.owner_user_id, u.username AS owner_username
      FROM questions q
      JOIN question_banks b ON b.id = q.bank_id
      LEFT JOIN users u ON u.id = b.owner_user_id
      WHERE q.id = ?
    `)
    .get(questionId);
}

function normalizeQuestionInput(input, existing = {}) {
  const sourceType = input.sourceType || existing.source_type || "street_view";
  const streetView = input.streetView || {};
  const lat = input.lat ?? streetView.lat ?? existing.lat;
  const lng = input.lng ?? streetView.lng ?? existing.lng;

  return {
    id: String(input.id ?? existing.id ?? crypto.randomUUID()).trim(),
    title: String(input.title ?? existing.title ?? "").trim(),
    description: String(input.description ?? existing.description ?? "").trim(),
    groupId: String(input.groupId ?? existing.bank_id ?? "").trim(),
    sourceType,
    lat,
    lng,
    heading: input.heading ?? streetView.heading ?? existing.heading ?? 0,
    pitch: input.pitch ?? streetView.pitch ?? existing.pitch ?? 0,
    fov: input.fov ?? streetView.fov ?? existing.fov ?? 100,
    panoId: input.panoId ?? streetView.panoId ?? existing.pano_id ?? null,
    imagePath: input.imageUrl ?? input.imagePath ?? existing.image_path ?? null
  };
}

export function listGroups(user) {
  return db
    .prepare(`
      SELECT b.*, u.username AS owner_username, COUNT(q.id) AS question_count
      FROM question_banks b
      LEFT JOIN users u ON u.id = b.owner_user_id
      LEFT JOIN questions q ON q.bank_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at ASC
    `)
    .all()
    .map((row) => bankRowToGroup(row, user));
}

export function getGroupById(groupId, user) {
  const row = getBankRow(groupId);
  return row ? bankRowToGroup({ ...row, question_count: countQuestions(groupId) }, user) : null;
}

function countQuestions(groupId) {
  return db.prepare("SELECT COUNT(*) AS count FROM questions WHERE bank_id = ?").get(groupId).count;
}

export function addGroup(input, user) {
  const id = String(input.id || "").trim();
  const title = String(input.title || "").trim();
  if (getBankRow(id)) {
    return { error: "Group id already exists" };
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO question_banks (id, title, owner_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title, user.id, timestamp, timestamp);

  return { group: getGroupById(id, user) };
}

export function updateGroup(groupId, input, user) {
  const bank = getBankRow(groupId);
  if (!bank) {
    return { error: "Group not found" };
  }
  if (!canEditBank(user, bank)) {
    return { error: "Forbidden" };
  }

  const nextId = input.id ? String(input.id).trim() : bank.id;
  if (nextId !== groupId && getBankRow(nextId)) {
    return { error: "Group id already exists" };
  }

  db.prepare(`
    UPDATE question_banks
    SET id = ?, title = ?, updated_at = ?
    WHERE id = ?
  `).run(nextId, input.title ?? bank.title, nowIso(), groupId);

  return { group: getGroupById(nextId, user) };
}

export function deleteGroup(groupId, user) {
  const bank = getBankRow(groupId);
  if (!bank) {
    return { error: "Group not found" };
  }
  if (!canEditBank(user, bank)) {
    return { error: "Forbidden" };
  }

  db.prepare("DELETE FROM question_banks WHERE id = ?").run(groupId);
  return { ok: true };
}

export function listQuestions(groupId, user) {
  const params = [];
  let where = "";
  if (groupId) {
    where = "WHERE q.bank_id = ?";
    params.push(groupId);
  }

  const rows = db
    .prepare(`
      SELECT q.*, b.title AS bank_title, b.owner_user_id, u.username AS owner_username
      FROM questions q
      JOIN question_banks b ON b.id = q.bank_id
      LEFT JOIN users u ON u.id = b.owner_user_id
      ${where}
      ORDER BY q.created_at ASC
    `)
    .all(...params);

  if (groupId && !getBankRow(groupId)) {
    return null;
  }

  return rows.map((row) => questionRowToQuestion(row, user));
}

export function getQuestionById(id, user) {
  const row = getQuestionRow(id);
  return row ? questionRowToQuestion(row, user) : null;
}

export function addQuestion(input, user) {
  const normalized = normalizeQuestionInput(input);
  if (getQuestionRow(normalized.id)) {
    return { error: "Question id already exists" };
  }

  const bank = getBankRow(normalized.groupId);
  if (!bank) {
    return { error: "Group not found" };
  }
  if (!canEditBank(user, bank)) {
    return { error: "Forbidden" };
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO questions (
      id, bank_id, title, description, source_type, lat, lng, heading, pitch, fov,
      pano_id, image_path, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    normalized.id,
    normalized.groupId,
    normalized.title,
    normalized.description,
    normalized.sourceType,
    normalized.lat,
    normalized.lng,
    normalized.heading,
    normalized.pitch,
    normalized.fov,
    normalized.panoId,
    normalized.imagePath,
    timestamp,
    timestamp
  );

  db.prepare("UPDATE question_banks SET updated_at = ? WHERE id = ?").run(timestamp, normalized.groupId);
  return { question: getQuestionById(normalized.id, user) };
}

export function updateQuestion(questionId, input, user) {
  const existing = getQuestionRow(questionId);
  if (!existing) {
    return { error: "Question not found" };
  }
  if (!canEditBank(user, existing)) {
    return { error: "Forbidden" };
  }

  const normalized = normalizeQuestionInput(input, existing);
  if (normalized.id !== questionId && getQuestionRow(normalized.id)) {
    return { error: "Question id already exists" };
  }

  const nextBank = getBankRow(normalized.groupId);
  if (!nextBank) {
    return { error: "Group not found" };
  }
  if (!canEditBank(user, nextBank)) {
    return { error: "Forbidden" };
  }

  const timestamp = nowIso();
  db.prepare(`
    UPDATE questions
    SET id = ?, bank_id = ?, title = ?, description = ?, source_type = ?,
      lat = ?, lng = ?, heading = ?, pitch = ?, fov = ?, pano_id = ?, image_path = ?, updated_at = ?
    WHERE id = ?
  `).run(
    normalized.id,
    normalized.groupId,
    normalized.title,
    normalized.description,
    normalized.sourceType,
    normalized.lat,
    normalized.lng,
    normalized.heading,
    normalized.pitch,
    normalized.fov,
    normalized.panoId,
    normalized.imagePath,
    timestamp,
    questionId
  );

  db.prepare("UPDATE question_banks SET updated_at = ? WHERE id IN (?, ?)").run(timestamp, existing.bank_id, normalized.groupId);
  return { question: getQuestionById(normalized.id, user) };
}

export function deleteQuestion(questionId, user) {
  const existing = getQuestionRow(questionId);
  if (!existing) {
    return { error: "Question not found" };
  }
  if (!canEditBank(user, existing)) {
    return { error: "Forbidden" };
  }

  db.prepare("DELETE FROM questions WHERE id = ?").run(questionId);
  db.prepare("UPDATE question_banks SET updated_at = ? WHERE id = ?").run(nowIso(), existing.bank_id);
  return { ok: true };
}
