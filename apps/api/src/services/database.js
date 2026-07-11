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
  migrateAddNotificationsTable();
  migrateAddSocialTables();
  migrateAddOrgFields();
  migrateAddDailyChallengeAndXP();
  migrateFixDailyChallengeUnique();
  migrateAddMarketplaceAndTeams();
  migrateAddPvPandStreakAndBR();
  migrateAddCharacterAndCardSystem();
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

function cryptoRandomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
