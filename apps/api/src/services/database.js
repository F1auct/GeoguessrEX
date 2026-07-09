import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(apiRoot, "data");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "geoguesr.sqlite");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.exec("PRAGMA foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      email_key TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      password_key_length INTEGER NOT NULL,
      password_digest TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_banks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      owner_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'street_view',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      heading REAL NOT NULL DEFAULT 0,
      pitch REAL NOT NULL DEFAULT 0,
      fov REAL NOT NULL DEFAULT 100,
      pano_id TEXT,
      image_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
    );
  `);

  migrateDropQuestionTitle();
  seedQuestionsFromJson();
}

// 兼容已存在的开发库：若旧的 questions 表仍有 title 列则删除它
function migrateDropQuestionTitle() {
  const hasTitle = db
    .prepare("PRAGMA table_info(questions)")
    .all()
    .some((column) => column.name === "title");

  if (hasTitle) {
    db.exec("ALTER TABLE questions DROP COLUMN title");
  }
}

function seedQuestionsFromJson() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM question_banks").get().count;
  if (count > 0) {
    return;
  }

  const questionsPath = path.resolve(__dirname, "../data/questions.json");
  if (!fs.existsSync(questionsPath)) {
    return;
  }

  const raw = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
  const groups = Array.isArray(raw)
    ? [{ id: "default", title: "默认题库", questions: raw }]
    : Array.isArray(raw?.groups)
      ? raw.groups
      : [];

  const now = new Date().toISOString();
  const insertBank = db.prepare(`
    INSERT INTO question_banks (id, title, owner_user_id, created_at, updated_at)
    VALUES (?, ?, NULL, ?, ?)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO questions (
      id, bank_id, description, source_type, lat, lng, heading, pitch, fov, pano_id, image_path, created_at, updated_at
    )
    VALUES (?, ?, ?, 'street_view', ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const group of groups) {
      const bankId = String(group.id || cryptoRandomId("bank")).trim();
      insertBank.run(bankId, String(group.title || "未命名题库").trim(), now, now);

      for (const question of Array.isArray(group.questions) ? group.questions : []) {
        if (!question?.streetView) {
          continue;
        }
        insertQuestion.run(
          String(question.id || cryptoRandomId("q")).trim(),
          bankId,
          String(question.description || "").trim(),
          Number(question.streetView.lat),
          Number(question.streetView.lng),
          Number(question.streetView.heading ?? 0),
          Number(question.streetView.pitch ?? 0),
          Number(question.streetView.fov ?? 100),
          question.streetView.panoId ?? null,
          now,
          now
        );
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function cryptoRandomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
