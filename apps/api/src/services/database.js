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
  migrateNewFeatureTables();
  seedQuestionsFromJson();
}

function migrateNewFeatureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      balance_coin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coin_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('recharge', 'withdraw', 'bounty_reward', 'bounty_create', 'bounty_refund')),
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reward_coin INTEGER NOT NULL DEFAULT 0,
      deadline TEXT NOT NULL,
      question_data TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
      winner_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bounty_submissions (
      id TEXT PRIMARY KEY,
      bounty_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      guess_lat REAL NOT NULL,
      guess_lng REAL NOT NULL,
      distance_km REAL NOT NULL,
      score INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS treasure_games (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      game_type TEXT NOT NULL CHECK (game_type IN ('treasure_hunt', 'reasoning')),
      region TEXT NOT NULL DEFAULT '',
      require_player_info INTEGER NOT NULL DEFAULT 0,
      player_info_fields TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'active', 'completed')),
      reviewed_by TEXT,
      review_reason TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS location_tasks (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      arrival_hint TEXT NOT NULL DEFAULT '',
      next_location_hint TEXT NOT NULL DEFAULT '',
      target_lat REAL NOT NULL,
      target_lng REAL NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'gps_check' CHECK (task_type IN ('gps_check', 'photo_upload')),
      task_config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES treasure_games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_registrations (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      player_info TEXT NOT NULL DEFAULT '{}',
      info_consented INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES treasure_games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS game_progress (
      id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      completed_steps TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (registration_id) REFERENCES game_registrations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES treasure_games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL CHECK (category IN ('lost_item', 'found_item', 'missing_person', 'announcement', 'other')),
      region TEXT NOT NULL DEFAULT '',
      contact_info TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
      reviewed_by TEXT,
      review_reason TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('game', 'community_post')),
      target_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
    CREATE INDEX IF NOT EXISTS idx_bounties_creator ON bounties(creator_id);
    CREATE INDEX IF NOT EXISTS idx_bounty_submissions_bounty ON bounty_submissions(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_treasure_games_status ON treasure_games(status);
    CREATE INDEX IF NOT EXISTS idx_treasure_games_region ON treasure_games(region);
    CREATE INDEX IF NOT EXISTS idx_location_tasks_game ON location_tasks(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_registrations_game ON game_registrations(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_registrations_user ON game_registrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_progress_user ON game_progress(user_id, game_id);
    CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
    CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
  `);

  // 添加 media_list 列（兼容已存在的库）
  migrateAddCommunityMediaList();
  // 放宽 reviews.action 约束以支持 revoke
  migrateReviewsAllowRevoke();
  migrateAddRevokedStatus();
  migrateAddGameMediaList();
  migrateAddNotificationsTable();
  migrateAddSocialTables();
  migrateAddOrgFields();
  migrateAddDailyChallengeAndXP();
  migrateFixDailyChallengeUnique();
  migrateAddMarketplaceAndTeams();
  migrateAddPvPandStreakAndBR();
  migrateAddCharacterAndCardSystem();
  migrateAddWorldTour();
  migrateAddRankedSystem();
  migrateAddPeakSystem();
  migrateAddSeasonQuests();
}

function migrateAddPvPandStreakAndBR() {
  // 兼容已存在的表，添加缺失列
  const pvpHasHistory = db.prepare("PRAGMA table_info(pvp_rooms)").all().some(c => c.name === "round_history");
  if (!pvpHasHistory) {
    try { db.exec("ALTER TABLE pvp_rooms ADD COLUMN round_history TEXT NOT NULL DEFAULT '[]'"); } catch {}
  }
  const brHasReady = db.prepare("PRAGMA table_info(br_players)").all().some(c => c.name === "ready");
  if (!brHasReady) {
    try { db.exec("ALTER TABLE br_players ADD COLUMN ready INTEGER NOT NULL DEFAULT 0"); } catch {}
  }
  const brHasHost = db.prepare("PRAGMA table_info(br_rooms)").all().some(c => c.name === "host_id");
  if (!brHasHost) {
    try { db.exec("ALTER TABLE br_rooms ADD COLUMN host_id TEXT"); } catch {}
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS pvp_rooms (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, creator_id TEXT NOT NULL,
      joiner_id TEXT, status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','playing','finished')),
      question_data TEXT, creator_guess TEXT, joiner_guess TEXT,
      creator_score INTEGER, joiner_score INTEGER, winner_id TEXT,
      round_history TEXT NOT NULL DEFAULT '[]',
      round INTEGER NOT NULL DEFAULT 1, max_rounds INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (joiner_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS country_streaks (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    );
    CREATE TABLE IF NOT EXISTS br_rooms (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('lobby','playing','finished')),
      question_data TEXT, round INTEGER NOT NULL DEFAULT 1,
      max_players INTEGER NOT NULL DEFAULT 8, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS br_players (
      id TEXT PRIMARY KEY, room_id TEXT NOT NULL, user_id TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0, alive INTEGER NOT NULL DEFAULT 1,
      guess TEXT, joined_at TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES br_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, season_number INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      theme TEXT DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS season_pass (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, season_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
      UNIQUE(user_id, season_id)
    );
  `);
}

function migrateAddCharacterAndCardSystem() {
  // users 表新增 selected_character
  const hasChar = db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "selected_character");
  if (!hasChar) {
    try { db.exec("ALTER TABLE users ADD COLUMN selected_character TEXT NOT NULL DEFAULT 'explorer'"); } catch {}
  }

  // pvp_rooms 新增角色/卡牌/技能/计时字段
  const pvpCols = ["creator_character", "joiner_character", "creator_card", "joiner_card",
    "creator_card_used", "joiner_card_used", "creator_skill_used", "joiner_skill_used",
    "round_started_at", "creator_guess_count", "joiner_guess_count"];
  for (const col of pvpCols) {
    const exists = db.prepare("PRAGMA table_info(pvp_rooms)").all().some(c => c.name === col);
    if (!exists) {
      const defaultVal = ["creator_card_used", "joiner_card_used", "creator_skill_used", "joiner_skill_used"].includes(col) ? "0"
        : ["creator_guess_count", "joiner_guess_count"].includes(col) ? "0"
        : col === "round_started_at" ? "NULL"
        : "''";
      try { db.exec(`ALTER TABLE pvp_rooms ADD COLUMN ${col} ${col === "round_started_at" ? "TEXT" : col.endsWith("_used") || col.endsWith("_count") ? "INTEGER NOT NULL DEFAULT" : "TEXT NOT NULL DEFAULT"} ${defaultVal}`); } catch {}
    }
  }

  // br_players 新增角色/卡牌/技能字段
  const brPlayerCols = ["character", "card", "card_used", "skill_used", "skill_cooldown", "guess_submitted_at"];
  for (const col of brPlayerCols) {
    const exists = db.prepare("PRAGMA table_info(br_players)").all().some(c => c.name === col);
    if (!exists) {
      const isInt = col === "card_used" || col === "skill_used" || col === "skill_cooldown";
      const defaultVal = isInt ? "0"
        : col === "guess_submitted_at" ? "NULL"
        : "''";
      const colType = isInt ? "INTEGER NOT NULL DEFAULT"
        : col === "guess_submitted_at" ? "TEXT DEFAULT"
        : "TEXT NOT NULL DEFAULT";
      try { db.exec(`ALTER TABLE br_players ADD COLUMN ${col} ${colType} ${defaultVal}`); } catch {}
    }
  }

  // br_rooms 新增计时字段
  const brHasTimer = db.prepare("PRAGMA table_info(br_rooms)").all().some(c => c.name === "round_started_at");
  if (!brHasTimer) {
    try { db.exec("ALTER TABLE br_rooms ADD COLUMN round_started_at TEXT"); } catch {}
  }

  // 补救：skill_cooldown 可能因之前的迁移 bug 未创建
  const hasSkillCd = db.prepare("PRAGMA table_info(br_players)").all().some(c => c.name === "skill_cooldown");
  if (!hasSkillCd) {
    try { db.exec("ALTER TABLE br_players ADD COLUMN skill_cooldown INTEGER NOT NULL DEFAULT 0"); } catch {}
  }

  // 用户已使用的传说卡牌追踪
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_used_cards (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, card_id TEXT NOT NULL,
      used_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, card_id)
    );
  `);

  // 角色锁定相关字段
  const pvpLockCols = ["creator_locked", "joiner_locked", "select_deadline"];
  for (const col of pvpLockCols) {
    const exists = db.prepare("PRAGMA table_info(pvp_rooms)").all().some(c => c.name === col);
    if (!exists) {
      const def = col === "select_deadline" ? "NULL" : "0";
      try { db.exec(`ALTER TABLE pvp_rooms ADD COLUMN ${col} ${col === "select_deadline" ? "TEXT" : "INTEGER NOT NULL DEFAULT"} ${def}`); } catch {}
    }
  }

  const brLockCols = ["character_locked"];
  for (const col of brLockCols) {
    const exists = db.prepare("PRAGMA table_info(br_players)").all().some(c => c.name === col);
    if (!exists) {
      try { db.exec(`ALTER TABLE br_players ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`); } catch {}
    }
  }
  const brHasDeadline = db.prepare("PRAGMA table_info(br_rooms)").all().some(c => c.name === "select_deadline");
  if (!brHasDeadline) {
    try { db.exec("ALTER TABLE br_rooms ADD COLUMN select_deadline TEXT"); } catch {}
  }

  // 角色使用追踪表
  db.exec(`
    CREATE TABLE IF NOT EXISTS character_usage (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 1, last_used_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, character_id)
    );
  `);
}

function migrateAddMarketplaceAndTeams() {
  const hasPrice = db.prepare("PRAGMA table_info(question_banks)").all().some(c => c.name === "price");
  if (!hasPrice) {
    db.exec("ALTER TABLE question_banks ADD COLUMN price INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE question_banks ADD COLUMN is_listed INTEGER NOT NULL DEFAULT 0");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_purchases (
      id TEXT PRIMARY KEY, bank_id TEXT NOT NULL, buyer_id TEXT NOT NULL,
      price INTEGER NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(bank_id, buyer_id)
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '',
      owner_id TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
      joined_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(team_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
  `);
}

function migrateAddDailyChallengeAndXP() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE,
      question_data TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_challenge_submissions (
      id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, user_id TEXT NOT NULL,
      guess_lat REAL NOT NULL, guess_lng REAL NOT NULL, score INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(challenge_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL,
      streak INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
      UNIQUE(user_id, date)
    );
  `);
  const hasXp = db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "xp");
  if (!hasXp) {
    db.exec("ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1");
  }
}

// 修复 daily_challenges.date 的 UNIQUE 约束 — 应该允许多道题同一天
function migrateFixDailyChallengeUnique() {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='daily_challenges' AND sql LIKE '%UNIQUE%'").all();
  if (indexes.length > 0) {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_challenges_new (
        id TEXT PRIMARY KEY, date TEXT NOT NULL,
        question_data TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO daily_challenges_new SELECT * FROM daily_challenges;
      DROP TABLE daily_challenges;
      ALTER TABLE daily_challenges_new RENAME TO daily_challenges;
    `);
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function migrateAddOrgFields() {
  const hasOrgName = db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "org_name");
  if (!hasOrgName) {
    db.exec("ALTER TABLE users ADD COLUMN org_name TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE users ADD COLUMN org_verified INTEGER NOT NULL DEFAULT 0");
  }
}

function migrateAddSocialTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      user_id TEXT NOT NULL, content TEXT NOT NULL, parent_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      user_id TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(target_type, target_id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY, follower_id TEXT NOT NULL, following_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  `);
}

function migrateAddNotificationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);
}

function migrateAddCommunityMediaList() {
  const hasColumn = db
    .prepare("PRAGMA table_info(community_posts)")
    .all()
    .some((column) => column.name === "media_list");

  if (!hasColumn) {
    db.exec("ALTER TABLE community_posts ADD COLUMN media_list TEXT NOT NULL DEFAULT '[]'");
  }
}

function migrateAddGameMediaList() {
  const hasColumn = db
    .prepare("PRAGMA table_info(treasure_games)")
    .all()
    .some((column) => column.name === "media_list");

  if (!hasColumn) {
    db.exec("ALTER TABLE treasure_games ADD COLUMN media_list TEXT NOT NULL DEFAULT '[]'");
  }
}

function migrateReviewsAllowRevoke() {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reviews'").get();
  if (tableInfo && tableInfo.sql.includes("'revoke'")) {
    return; // already migrated
  }

  // SQLite doesn't support ALTER TABLE DROP CHECK, so we recreate the table
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE reviews_new (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL CHECK (target_type IN ('game', 'community_post')),
        target_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'revoke')),
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO reviews_new SELECT * FROM reviews;
      DROP TABLE reviews;
      ALTER TABLE reviews_new RENAME TO reviews;
      CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
    `);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
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

function migrateAddRevokedStatus() {
  // Recreate treasure_games with 'revoked' in CHECK
  const gamesSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='treasure_games'").get();
  if (gamesSql && !gamesSql.sql.includes("'revoked'")) {
    db.exec("BEGIN");
    try {
      db.exec(`
        CREATE TABLE treasure_games_new (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          game_type TEXT NOT NULL CHECK (game_type IN ('treasure_hunt', 'reasoning')),
          region TEXT NOT NULL DEFAULT '',
          require_player_info INTEGER NOT NULL DEFAULT 0,
          player_info_fields TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'revoked', 'active', 'completed')),
          reviewed_by TEXT,
          review_reason TEXT,
          reviewed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        );
        INSERT INTO treasure_games_new SELECT * FROM treasure_games;
        DROP TABLE treasure_games;
        ALTER TABLE treasure_games_new RENAME TO treasure_games;
        CREATE INDEX IF NOT EXISTS idx_treasure_games_status ON treasure_games(status);
        CREATE INDEX IF NOT EXISTS idx_treasure_games_region ON treasure_games(region);
      `);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  // Recreate community_posts with 'revoked' in CHECK
  const postsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='community_posts'").get();
  if (postsSql && !postsSql.sql.includes("'revoked'")) {
    db.exec("BEGIN");
    try {
      db.exec(`
        CREATE TABLE community_posts_new (
          id TEXT PRIMARY KEY,
          author_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL CHECK (category IN ('lost_item', 'found_item', 'missing_person', 'announcement', 'other')),
          region TEXT NOT NULL DEFAULT '',
          contact_info TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'revoked')),
          reviewed_by TEXT,
          review_reason TEXT,
          reviewed_at TEXT,
          created_at TEXT NOT NULL,
          media_list TEXT NOT NULL DEFAULT '[]',
          FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        );
        INSERT INTO community_posts_new SELECT * FROM community_posts;
        DROP TABLE community_posts;
        ALTER TABLE community_posts_new RENAME TO community_posts;
        CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
        CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
      `);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

function migrateAddWorldTour() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
      xp_reward INTEGER NOT NULL DEFAULT 500,
      coin_reward INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      heading REAL NOT NULL DEFAULT 0,
      pitch REAL NOT NULL DEFAULT 0,
      fov REAL NOT NULL DEFAULT 100,
      pano_id TEXT,
      cultural_note TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_route_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      current_stop INTEGER NOT NULL DEFAULT 0,
      completed_stops TEXT NOT NULL DEFAULT '[]',
      total_score INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
      UNIQUE(user_id, route_id)
    );

    CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_user_route_progress_user ON user_route_progress(user_id);
  `);

  // Seed initial routes if empty
  const count = db.prepare("SELECT COUNT(*) AS count FROM routes").get().count;
  if (count > 0) return;

  const now = new Date().toISOString();
  const insertRoute = db.prepare(`
    INSERT INTO routes (id, title, subtitle, description, difficulty, xp_reward, coin_reward, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  const insertStop = db.prepare(`
    INSERT INTO route_stops (id, route_id, order_index, title, description, lat, lng, heading, pitch, fov, cultural_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const routes = [
    {
      id: "route_silk_road",
      title: "丝绸之路",
      subtitle: "从长安到伊斯坦布尔",
      description: "从古都长安出发，穿越塔什干与撒马尔罕的蓝色穹顶，跨越里海与高加索山脉，最终抵达欧亚交汇的伊斯坦布尔。重走这条连接东西方的古老商路，感受两千年的文明交融。",
      difficulty: "medium",
      xp_reward: 600,
      coin_reward: 60,
      stops: [
        { title: "西安 · 钟楼", desc: "丝绸之路的东方起点，十三朝古都的心脏。", lat: 34.2610, lng: 108.9420, heading: 0, pitch: 10, note: "西安古称长安，是丝绸之路的起点。钟楼建于明代，位于城市正中心，四条大街在此交汇。" },
        { title: "塔什干 · 帖木儿广场", desc: "中亚之心，丝路东段重镇。", lat: 41.3110, lng: 69.2797, heading: 0, pitch: 10, note: "塔什干是乌兹别克斯坦首都，中亚最大的城市之一，自古是丝路东段的重要枢纽。帖木儿广场得名于中亚征服者帖木儿，他建立的帝国以撒马尔罕为中心，打通了横跨欧亚的商路。" },
        { title: "撒马尔罕 · 雷吉斯坦广场", desc: "中亚的蓝宝石，帖木儿帝国的瑰宝。", lat: 39.6547, lng: 66.9757, heading: 270, pitch: 10, note: "撒马尔罕有2500多年历史，雷吉斯坦广场的三座神学院是世界伊斯兰建筑的代表作，蓝色瓷砖在阳光下熠熠生辉。" },
        { title: "布哈拉 · 卡隆宣礼塔", desc: "丝路上保存最完好的古城。", lat: 39.7762, lng: 64.4148, heading: 180, pitch: 5, note: "布哈拉地处丝路咽喉，是古代中亚的宗教与学术中心。卡隆宣礼塔高46米，建于12世纪，传说成吉思汗攻陷该城时曾为这座高塔的壮美而倾倒。" },
        { title: "巴库 · 少女塔", desc: "里海之滨的千年古城。", lat: 40.3665, lng: 49.8370, heading: 90, pitch: 5, note: "巴库老城是阿塞拜疆的历史中心，少女塔建于12世纪，是里海之滨最古老的建筑之一。巴库是丝路从里海通往高加索的必经之路，古城内的中世纪商队驿站见证着往来驼铃。" },
        { title: "第比利斯 · 老城", desc: "高加索的温泉古都。", lat: 41.6899, lng: 44.8085, heading: 180, pitch: 10, note: "第比利斯是格鲁吉亚首都，地处高加索山麓，是丝路北道的重镇。老城保留着中世纪以来的街道格局，蜿蜒小巷与硫磺浴池诉说着这座古城两千年来的故事。" },
        { title: "伊斯坦布尔 · 大巴扎", desc: "欧亚交汇的十字路口。", lat: 41.0100, lng: 28.9680, heading: 0, pitch: 10, note: "伊斯坦布尔横跨欧亚两大洲，是丝绸之路的终点。这里曾是拜占庭帝国和奥斯曼帝国的首都，拿破仑说：'如果世界是一个国家，它的首都就是伊斯坦布尔。'" },
      ]
    },
    {
      id: "route_pacific_ring",
      title: "环太平洋之旅",
      subtitle: "火山与都市的交响",
      description: "沿太平洋火山带环游，从东京的霓虹到西雅图的雨雾，见证这个星球上最壮观的地质活动和最多元的都市文明。",
      difficulty: "medium",
      xp_reward: 600,
      coin_reward: 60,
      stops: [
        { title: "东京 · 涩谷", desc: "世界最繁忙的十字路口。", lat: 35.6595, lng: 139.7004, heading: 270, pitch: 5, note: "涩谷十字路口每天有超过250万人通过，是东京城市活力的象征。日本列岛位于太平洋火山带上，国土的75%是山地。" },
        { title: "马尼拉 · 西班牙王城", desc: "热带岛国的历史印记。", lat: 14.5910, lng: 120.9750, heading: 0, pitch: 10, note: "菲律宾由7641个岛屿组成，马尼拉西班牙王城是16世纪西班牙殖民者建造的堡垒城市，诉说着这个岛国的复杂历史。" },
        { title: "雅加达 · 老城", desc: "千岛之国的活力首都。", lat: -6.1350, lng: 106.8130, heading: 90, pitch: 5, note: "印度尼西亚有超过17000个岛屿，雅加达位于爪哇岛。附近的喀拉喀托火山在1883年爆发，是人类历史上最猛烈的火山喷发之一。" },
        { title: "奥克兰 · 天空塔", desc: "帆船之都的碧海蓝天。", lat: -36.8485, lng: 174.7630, heading: 180, pitch: 10, note: "奥克兰建在50多座火山锥上，是全世界拥有帆船最多的城市。新西兰横跨太平洋板块和澳大利亚板块的交界处。" },
        { title: "圣地亚哥 · 武器广场", desc: "安第斯山麓的南美明珠。", lat: -33.4370, lng: -70.6500, heading: 90, pitch: 5, note: "智利国土南北绵延4300公里，东靠安第斯山脉，西临太平洋。圣地亚哥背靠白雪皑皑的安第斯山，是在地震带上顽强生长的城市。" },
        { title: "西雅图 · 派克市场", desc: "翡翠之城的咖啡香。", lat: 47.6090, lng: -122.3410, heading: 0, pitch: 10, note: "西雅图被雨林和雪山环绕，附近的雷尼尔山是一座活火山，海拔4392米。这里是星巴克的诞生地和波音公司的总部。" },
      ]
    },
    {
      id: "route_european_castles",
      title: "欧洲古堡之旅",
      subtitle: "穿越中世纪的石与梦",
      description: "从苏格兰高地到特兰西瓦尼亚，探访欧洲最美的六座古城堡，每个石头都在讲述骑士、公主与帝国的故事。",
      difficulty: "easy",
      xp_reward: 500,
      coin_reward: 50,
      stops: [
        { title: "爱丁堡 · 城堡", desc: "苏格兰高地的千年守望者。", lat: 55.9486, lng: -3.2008, heading: 0, pitch: 15, note: "爱丁堡城堡坐落在死火山岩顶上，从公元12世纪起就是苏格兰王室的住所。每年的爱丁堡军乐节在这里举行，风笛声穿越千年石墙。" },
        { title: "卢瓦尔河谷 · 香波堡", desc: "法国文艺复兴的巅峰杰作。", lat: 47.6160, lng: 1.5170, heading: 180, pitch: 10, note: "香波堡是卢瓦尔河谷最大的城堡，拥有440间房间和282个壁炉。据说双螺旋楼梯的设计者是达·芬奇，上下楼的人可以互相看见但永远不会相遇。" },
        { title: "新天鹅堡", desc: "巴伐利亚山间的童话。", lat: 47.5576, lng: 10.7498, heading: 225, pitch: 15, note: "新天鹅堡是路德维希二世国王的梦中之城，建于19世纪末。它启发了迪士尼城堡的设计，每年吸引超过130万游客，是欧洲最受欢迎的城堡之一。" },
        { title: "布拉格 · 城堡", desc: "世界上最大的古堡群。", lat: 50.0900, lng: 14.4000, heading: 90, pitch: 10, note: "布拉格城堡始建于公元9世纪，占地7万平方米，被吉尼斯纪录认证为世界最大的古城堡。圣维特主教座堂的彩色玻璃窗是阿尔丰斯·穆夏的杰作。" },
        { title: "布达佩斯 · 渔人堡", desc: "多瑙河畔的新哥特之梦。", lat: 47.5020, lng: 19.0340, heading: 270, pitch: 10, note: "渔人堡建于1905年，纯白的新罗马式建筑。从这里俯瞰多瑙河和对岸的国会大厦，是布达佩斯最美的景色。布达佩斯原本是两座城市：布达和佩斯。" },
        { title: "锡吉什瓦拉 · 城堡", desc: "德古拉伯爵的故乡。", lat: 46.2197, lng: 24.7930, heading: 135, pitch: 5, note: "锡吉什瓦拉是特兰西瓦尼亚保存最完好的中世纪要塞城市，也是弗拉德三世（德古拉伯爵的原型）的出生地。彩色房屋和钟楼是撒克逊建筑的代表。" },
      ]
    }
  ];

  db.exec("BEGIN");
  try {
    for (const route of routes) {
      insertRoute.run(route.id, route.title, route.subtitle, route.description, route.difficulty, route.xp_reward, route.coin_reward, now);
      for (let i = 0; i < route.stops.length; i++) {
        const s = route.stops[i];
        insertStop.run(
          `${route.id}_stop${i + 1}`, route.id, i + 1,
          s.title, s.desc, s.lat, s.lng, s.heading, s.pitch, 100, s.note
        );
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function migrateAddRankedSystem() {
  // users 表新增排位字段
  const hasRankTier = db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "rank_tier");
  if (!hasRankTier) {
    try { db.exec("ALTER TABLE users ADD COLUMN rank_tier TEXT NOT NULL DEFAULT 'bronze'"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN rank_stars INTEGER NOT NULL DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN rank_updated_at TEXT"); } catch {}
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS rank_matches (
      id TEXT PRIMARY KEY,
      winner_id TEXT NOT NULL,
      loser_id TEXT NOT NULL,
      winner_tier_before TEXT NOT NULL,
      winner_stars_before INTEGER NOT NULL,
      loser_tier_before TEXT NOT NULL,
      loser_stars_before INTEGER NOT NULL,
      winner_stars_change INTEGER NOT NULL,
      loser_stars_change INTEGER NOT NULL,
      room_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (loser_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rank_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rank_queue_tier ON rank_queue(tier, joined_at);
    CREATE INDEX IF NOT EXISTS idx_rank_matches_winner ON rank_matches(winner_id);
    CREATE INDEX IF NOT EXISTS idx_rank_matches_loser ON rank_matches(loser_id);
  `);
}

function migrateAddPeakSystem() {
  const hasPeakScore = db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "peak_score");
  if (!hasPeakScore) {
    try { db.exec("ALTER TABLE users ADD COLUMN peak_score INTEGER NOT NULL DEFAULT 1200"); } catch {}
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS peak_matches (
      id TEXT PRIMARY KEY,
      winner_id TEXT NOT NULL,
      loser_id TEXT NOT NULL,
      winner_score_before INTEGER NOT NULL,
      winner_score_after INTEGER NOT NULL,
      loser_score_before INTEGER NOT NULL,
      loser_score_after INTEGER NOT NULL,
      winner_score_change INTEGER NOT NULL,
      loser_score_change INTEGER NOT NULL,
      season_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (loser_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS peak_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      peak_score INTEGER NOT NULL,
      joined_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_peak_matches_winner ON peak_matches(winner_id);
    CREATE INDEX IF NOT EXISTS idx_peak_matches_loser ON peak_matches(loser_id);
    CREATE INDEX IF NOT EXISTS idx_peak_queue_score ON peak_queue(peak_score);
  `);
}

function migrateAddSeasonQuests() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS season_quests (
      id TEXT PRIMARY KEY,
      quest_type TEXT NOT NULL CHECK (quest_type IN ('daily','weekly','season')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL,
      target_count INTEGER NOT NULL DEFAULT 1,
      reward_xp INTEGER NOT NULL DEFAULT 50,
      reward_coin INTEGER NOT NULL DEFAULT 0,
      season_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_quest_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      current_count INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (quest_id) REFERENCES season_quests(id) ON DELETE CASCADE,
      UNIQUE(user_id, quest_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user ON user_quest_progress(user_id, date);
  `);

  // Seed initial quests if empty
  const count = db.prepare("SELECT COUNT(*) AS count FROM season_quests").get().count;
  if (count > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO season_quests (id, quest_type, title, description, target_type, target_count, reward_xp, reward_coin, season_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)
  `);

  const quests = [
    // 日常
    { id: "dq_ranked_3", type: "daily", title: "排位高手", desc: "完成 3 局排位赛", target: "ranked_games", count: 3, xp: 50, coin: 10 },
    { id: "dq_asia_5", type: "daily", title: "亚洲通", desc: "在亚洲国家猜对 5 次", target: "asia_correct", count: 5, xp: 30, coin: 5 },
    { id: "dq_score_4000", type: "daily", title: "精准一击", desc: "单局得分 ≥ 4000", target: "high_score", count: 1, xp: 40, coin: 10 },
    { id: "dq_pvp_win", type: "daily", title: "对战之星", desc: "赢得 1 局 PvP 对战", target: "pvp_win", count: 1, xp: 40, coin: 10 },
    { id: "dq_submit", type: "daily", title: "贡献者", desc: "提交 1 道题目进入审核", target: "question_submit", count: 1, xp: 30, coin: 5 },
    // 周常
    { id: "wq_ranked_10", type: "weekly", title: "排位狂热", desc: "排位赛胜利 10 局", target: "ranked_wins", count: 10, xp: 300, coin: 50 },
    { id: "wq_countries_5", type: "weekly", title: "环球旅行家", desc: "在 5 个不同国家猜对位置", target: "countries_correct", count: 5, xp: 200, coin: 30 },
    { id: "wq_streak_7", type: "weekly", title: "坚持不懈", desc: "连续 7 天签到", target: "checkin_streak", count: 7, xp: 250, coin: 40 },
    { id: "wq_peak_3", type: "weekly", title: "巅峰之路", desc: "完成 3 局巅峰赛", target: "peak_games", count: 3, xp: 200, coin: 40 },
    { id: "wq_route_1", type: "weekly", title: "环球旅者", desc: "完成 1 条环球之旅路线", target: "route_complete", count: 1, xp: 350, coin: 60 },
    // 赛季
    { id: "sq_gold", type: "season", title: "黄金强者", desc: "达到黄金段位", target: "rank_tier_gold", count: 1, xp: 1000, coin: 100 },
    { id: "sq_100_ranked", type: "season", title: "排位百战", desc: "完成 100 局排位赛", target: "ranked_games_total", count: 100, xp: 800, coin: 80 },
    { id: "sq_peak_win_3", type: "season", title: "巅峰强者", desc: "巅峰赛胜利 3 局", target: "peak_wins", count: 3, xp: 1200, coin: 150 },
  ];

  db.exec("BEGIN");
  try {
    for (const q of quests) insert.run(q.id, q.type, q.title, q.desc, q.target, q.count, q.xp, q.coin, now);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function cryptoRandomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
