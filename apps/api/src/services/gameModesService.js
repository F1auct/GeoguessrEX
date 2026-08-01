import crypto from "crypto";
import { db } from "./database.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { scoreFromDistance } from "../utils/scoring.js";
import { addXP } from "./xpService.js";
import { addSeasonXP } from "./seasonService.js";
import {
  getCharacter, getCard, drawCard, consumeLegendaryCard,
  applyPassiveScore, applyCardEffect, getDistanceHint, detectContinent, detectTerrain,
  recordCharacterUsage, getMostUsedCharacter
} from "./characterService.js";

const ROUND_TIME_SEC = 60;
const SELECT_TIMEOUT_SEC = 30;

function nowIso() { return new Date().toISOString(); }
function genCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

// ═══════════════ 国家连击 ═══════════════
const COUNTRY_MAP = [
  { latMin: 48, latMax: 50, lngMin: 1, lngMax: 8, country: "法国" },
  { latMin: 34, latMax: 42, lngMin: -125, lngMax: -66, country: "美国" },
  { latMin: 30, latMax: 46, lngMin: 129, lngMax: 146, country: "日本" },
  { latMin: 50, latMax: 59, lngMin: -8, lngMax: 2, country: "英国" },
  { latMin: 18, latMax: 54, lngMin: 73, lngMax: 135, country: "中国" },
  { latMin: -35, latMax: -12, lngMin: 113, lngMax: 154, country: "澳大利亚" },
  { latMin: 36, latMax: 47, lngMin: 6, lngMax: 19, country: "意大利" },
  { latMin: -34, latMax: 5, lngMin: -74, lngMax: -34, country: "巴西" },
  { latMin: 36, latMax: 44, lngMin: -10, lngMax: 4, country: "西班牙" },
  { latMin: 47, latMax: 56, lngMin: 5, lngMax: 16, country: "德国" },
];

function detectCountry(lat, lng) {
  for (const c of COUNTRY_MAP) if (lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax) return c.country;
  return "未知";
}

export function getCountryQuestion() {
  const q = db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT 1").get();
  if (!q) return null;
  return { lat: q.lat, lng: q.lng, heading: q.heading || 0, pitch: q.pitch || 0, fov: q.fov || 90, title: q.description || "" };
}

export function submitCountryGuess(userId, guess) {
  const country = detectCountry(guess.lat, guess.lng);
  const correctCountry = detectCountry(guess.actualLat, guess.actualLng);
  const correct = country === correctCountry;
  let streak = db.prepare("SELECT * FROM country_streaks WHERE user_id=?").get(userId);
  if (!streak) { db.prepare("INSERT INTO country_streaks (id,user_id,streak,best_streak,updated_at) VALUES (?,?,0,0,?)").run(crypto.randomUUID(), userId, nowIso()); streak = { streak: 0, best_streak: 0 }; }
  if (correct) {
    const ns = streak.streak + 1, nb = Math.max(streak.best_streak, ns);
    db.prepare("UPDATE country_streaks SET streak=?, best_streak=?, updated_at=? WHERE user_id=?").run(ns, nb, nowIso(), userId);
    if (ns % 5 === 0) addXP(userId, 30);
    return { correct: true, country: correctCountry, streak: ns, bestStreak: nb };
  }
  db.prepare("UPDATE country_streaks SET streak=0, updated_at=? WHERE user_id=?").run(nowIso(), userId);
  return { correct: false, country, correctCountry, streak: 0, bestStreak: streak.best_streak };
}

export function getStreakLeaderboard() {
  return db.prepare("SELECT cs.*, u.username FROM country_streaks cs JOIN users u ON u.id=cs.user_id ORDER BY cs.best_streak DESC LIMIT 20")
    .all().map((r, i) => ({ rank: i + 1, userId: r.user_id, username: r.username, bestStreak: r.best_streak, streak: r.streak }));
}

// ═══════════════ 大逃杀 ═══════════════

export function createBRRoom(hostId) {
  const q = db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT 1").get();
  if (!q) return { error: "无可用题目", status: 500 };

  const card = drawCard(hostId);
  const id = crypto.randomUUID(), code = genCode();
  db.prepare("INSERT INTO br_rooms (id,code,host_id,status,question_data,round_started_at,created_at) VALUES (?,?,?,'lobby',?,?,?)")
    .run(id, code, hostId, JSON.stringify({ lat: q.lat, lng: q.lng, heading: q.heading || 0, pitch: q.pitch || 0, fov: q.fov || 90 }), nowIso(), nowIso());
  // 房主自动加入，但不锁定角色
  db.prepare("INSERT INTO br_players (id,room_id,user_id,ready,character,card,character_locked,joined_at) VALUES (?,?,?,1,'',?,0,?)")
    .run(crypto.randomUUID(), id, hostId, JSON.stringify(card), nowIso());
  return { room: getBRRoom(code) };
}

export function joinBRRoom(code, userId) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "lobby") return { error: "比赛已开始", status: 400 };
  if (db.prepare("SELECT id FROM br_players WHERE room_id=? AND user_id=?").get(r.id, userId)) return { error: "已在房间中", status: 400 };
  if (db.prepare("SELECT COUNT(*) AS c FROM br_players WHERE room_id=? AND alive=1").get(r.id).c >= r.max_players) return { error: "房间已满", status: 400 };

  const card = drawCard(userId);
  db.prepare("INSERT INTO br_players (id,room_id,user_id,ready,character,card,character_locked,joined_at) VALUES (?,?,?,0,'',?,0,?)")
    .run(crypto.randomUUID(), r.id, userId, JSON.stringify(card), nowIso());
  return { room: getBRRoom(code) };
}

/** BR 锁定角色 */
export function lockBRCharacter(code, userId, characterId) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "lobby") return { error: "当前阶段不可选角", status: 400 };

  const p = db.prepare("SELECT * FROM br_players WHERE room_id=? AND user_id=? AND alive=1").get(r.id, userId);
  if (!p) return { error: "不在房间中", status: 404 };
  if (p.character_locked) return { error: "已锁定", status: 400 };

  const char = getCharacter(characterId);
  if (!char) return { error: "无效角色", status: 400 };

  db.prepare("UPDATE br_players SET character=?, character_locked=1 WHERE id=?").run(characterId, p.id);
  recordCharacterUsage(userId, characterId);

  return { room: getBRRoom(code), locked: true };
}

export function toggleBRReady(code, userId) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "lobby") return { error: "比赛已开始", status: 400 };
  if (r.host_id === userId) return { error: "房主无需准备", status: 400 };
  const p = db.prepare("SELECT * FROM br_players WHERE room_id=? AND user_id=?").get(r.id, userId);
  if (!p) return { error: "不在房间中", status: 404 };
  if (!p.character_locked) return { error: "请先锁定角色", status: 400 };
  db.prepare("UPDATE br_players SET ready=? WHERE id=?").run(p.ready ? 0 : 1, p.id);
  return { room: getBRRoom(code) };
}

export function startBRRoom(code, userId) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r || r.status !== "lobby") return { error: "无法开始", status: 400 };
  if (r.host_id !== userId) return { error: "只有房主可以开始", status: 403 };

  // 自动锁定未锁定角色
  const unlocked = db.prepare("SELECT * FROM br_players WHERE room_id=? AND alive=1 AND character_locked=0").all(r.id);
  for (const p of unlocked) {
    const autoChar = getMostUsedCharacter(p.user_id) || getRandomCharId();
    db.prepare("UPDATE br_players SET character=?, character_locked=1 WHERE id=?").run(autoChar, p.id);
    recordCharacterUsage(p.user_id, autoChar);
  }

  const allLocked = db.prepare("SELECT COUNT(*) AS c FROM br_players WHERE room_id=? AND alive=1 AND character_locked=1").get(r.id).c;
  const allReady = db.prepare("SELECT COUNT(*) AS c FROM br_players WHERE room_id=? AND alive=1 AND (ready=1 OR user_id=?)").get(r.id, r.host_id).c;
  const total = db.prepare("SELECT COUNT(*) AS c FROM br_players WHERE room_id=? AND alive=1").get(r.id).c;
  if (allLocked < total) return { error: "还有玩家未锁定角色", status: 400 };
  if (allReady < total) return { error: "还有玩家未准备", status: 400 };
  if (total < 2) return { error: "至少需要2名玩家", status: 400 };

  db.prepare("UPDATE br_rooms SET status='playing', round_started_at=? WHERE id=?").run(nowIso(), r.id);
  return { room: getBRRoom(code) };
}

function getRandomCharId() {
  const chars = ["explorer", "hunter", "seer", "swift", "guardian", "gambler"];
  return chars[Math.floor(Math.random() * chars.length)];
}

// ═══ 以下函数保持不变 ═══

export function useBRSkill(code, userId) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "playing") return { error: "对局未开始", status: 400 };

  const p = db.prepare("SELECT * FROM br_players WHERE room_id=? AND user_id=? AND alive=1").get(r.id, userId);
  if (!p) return { error: "不在房间中或已淘汰", status: 400 };
  if (p.skill_used) return { error: "技能已使用", status: 400 };

  const char = getCharacter(p.character);
  if (!char) return { error: "角色不存在", status: 400 };
  if (p.skill_cooldown > 0) return { error: `技能冷却中，还需${p.skill_cooldown}轮`, status: 400 };

  db.prepare("UPDATE br_players SET skill_used=1, skill_cooldown=? WHERE id=?").run(char.active.cooldownRounds || 0, p.id);

  const qd = JSON.parse(r.question_data);
  let skillData = { characterId: char.id, skillName: char.active.name };
  switch (char.id) {
    case "explorer": skillData = { ...skillData, type: "distance_hint", ready: true }; break;
    case "hunter": skillData = { ...skillData, type: "focus_area", targetLat: qd.lat, targetLng: qd.lng, radius: 500 }; break;
    case "seer": skillData = { ...skillData, type: "terrain_reveal", terrain: detectTerrain(qd.lat, qd.lng) }; break;
    case "swift": skillData = { ...skillData, type: "dual_mark", ready: true }; break;
    case "guardian": skillData = { ...skillData, type: "score_floor", minScore: 1500 }; break;
    case "gambler": skillData = { ...skillData, type: "all_in", ready: true }; break;
    default: break;
  }

  return { skillUsed: true, skillData, room: getBRRoom(code) };
}

export function useBRCard(code, userId) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "playing") return { error: "对局未开始", status: 400 };

  const p = db.prepare("SELECT * FROM br_players WHERE room_id=? AND user_id=? AND alive=1").get(r.id, userId);
  if (!p) return { error: "不在房间中或已淘汰", status: 400 };
  if (p.card_used) return { error: "卡牌已使用", status: 400 };
  if (!p.card) return { error: "无可用卡牌", status: 400 };

  const card = JSON.parse(p.card);
  db.prepare("UPDATE br_players SET card_used=1 WHERE id=?").run(p.id);

  const cardObj = getCard(card.id);
  if (cardObj && cardObj.rarity === "legendary") {
    consumeLegendaryCard(userId, card.id);
  }

  return { cardUsed: true, cardData: card, room: getBRRoom(code) };
}

export function submitBRGuess(code, userId, guess, options = {}) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r || r.status !== "playing") return { error: "对局未开始", status: 400 };
  const p = db.prepare("SELECT * FROM br_players WHERE room_id=? AND user_id=? AND alive=1").get(r.id, userId);
  if (!p) return { error: "不在房间中或已淘汰", status: 400 };
  if (p.guess && !options.isRewind) return { error: "本轮已提交", status: 400 };

  const qd = JSON.parse(r.question_data);
  const char = getCharacter(p.character);

  let finalGuess = guess;
  if (options.swiftDualGuess && char?.id === "swift") {
    const d1 = haversineDistanceKm(guess.lat, guess.lng, qd.lat, qd.lng);
    const d2 = haversineDistanceKm(options.swiftDualGuess.lat, options.swiftDualGuess.lng, qd.lat, qd.lng);
    if (d2 < d1) finalGuess = options.swiftDualGuess;
  }

  let distanceKm = haversineDistanceKm(finalGuess.lat, finalGuess.lng, qd.lat, qd.lng);

  if (options.cardEffect === "guess_offset") {
    distanceKm = Math.max(0, distanceKm - 50);
  }

  let score = scoreFromDistance(distanceKm);

  // 服务端检查技能使用状态（后备，防止前端状态丢失）
  const skillActive = options.skillType || (p.skill_used && char?.id === "guardian" ? "score_floor" : null);
  if (skillActive === "score_floor") {
    score = Math.max(score, 1500);
  }

  const roundStartTime = r.round_started_at ? new Date(r.round_started_at).getTime() : Date.now();
  const elapsed = (Date.now() - roundStartTime) / 1000;
  const isFastSubmit = elapsed < ROUND_TIME_SEC / 2;

  const passive = applyPassiveScore(p.character, score, { roundNumber: r.round, distanceKm, isFastSubmit });
  score = passive.score;

  // 卡牌已使用 (p.card_used=1) 时应用效果；options.cardActive 作为前端后备
  if ((options.cardActive || p.card_used) && p.card) {
    const card = JSON.parse(p.card);
    const cardResult = applyCardEffect(card.id, score);
    score = cardResult.score;
  }

  if (options.cardActive && options.cardEffect === "perfect_score") { score = 5000; }

  if (options.isRewind && p.guess) {
    const prev = db.prepare("SELECT score FROM br_players WHERE id=?").get(p.id);
    const prevRoundScore = prev.score - (p.score || 0);
    if (score < prevRoundScore) score = prevRoundScore;
  }

  const guessJson = JSON.stringify(finalGuess);
  db.prepare("UPDATE br_players SET score=score+?, guess=?, guess_submitted_at=? WHERE id=?")
    .run(score, guessJson, nowIso(), p.id);

  const alive = db.prepare("SELECT * FROM br_players WHERE room_id=? AND alive=1").all(r.id);
  if (alive.every(a => a.guess)) {
    return resolveBRRound(r, alive);
  }

  return { room: getBRRoom(code), submitted: true, score, distanceKm };
}

function resolveBRRound(room, alivePlayers) {
  const aliveCount = alivePlayers.length;

  if (aliveCount > 1) {
    const lowest = alivePlayers.reduce((min, a) => a.score < min.score ? a : min);
    const lowestChar = getCharacter(lowest.character);

    if (lowestChar?.id === "guardian") {
      const others = alivePlayers.filter(a => a.id !== lowest.id);
      if (others.length > 0) {
        const secondLowest = others.reduce((min, a) => a.score < min.score ? a : min);
        const survivorScore = Math.round(secondLowest.score * 0.9);
        db.prepare("UPDATE br_players SET score=? WHERE id=?").run(survivorScore, lowest.id);
        db.prepare("UPDATE br_players SET alive=0 WHERE id=?").run(secondLowest.id);
      }
    } else {
      db.prepare("UPDATE br_players SET alive=0 WHERE id=?").run(lowest.id);
    }

    const remaining = db.prepare("SELECT COUNT(*) AS c FROM br_players WHERE room_id=? AND alive=1").get(room.id).c;

    if (remaining <= 1) {
      db.prepare("UPDATE br_rooms SET status='finished' WHERE id=?").run(room.id);
      const winner = db.prepare("SELECT user_id FROM br_players WHERE room_id=? AND alive=1").get(room.id);
      if (winner) { addXP(winner.user_id, 150); addSeasonXP(winner.user_id, 200); }
    } else {
      const q = db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT 1").get();
      if (q) {
        db.prepare("UPDATE br_rooms SET question_data=?, round=round+1, round_started_at=? WHERE id=?")
          .run(JSON.stringify({ lat: q.lat, lng: q.lng, heading: q.heading || 0, pitch: q.pitch || 0, fov: q.fov || 90 }), nowIso(), room.id);
        db.prepare("UPDATE br_players SET guess=NULL, skill_used=0, skill_cooldown=CASE WHEN skill_cooldown>0 THEN skill_cooldown-1 ELSE 0 END, card_used=0 WHERE room_id=? AND alive=1").run(room.id);
      }
    }
  }

  return { room: getBRRoom(room.code), roundResolved: true };
}

export function getBRRoom(code) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return null;

  let roundTimeLeft = 0;
  if (r.status === "playing" && r.round_started_at) {
    const elapsed = (Date.now() - new Date(r.round_started_at).getTime()) / 1000;
    roundTimeLeft = Math.max(0, Math.ceil(ROUND_TIME_SEC - elapsed));
  }

  const allPlayers = db.prepare("SELECT p.*, u.username FROM br_players p JOIN users u ON u.id=p.user_id WHERE p.room_id=? ORDER BY p.score DESC").all(r.id);
  return {
    id: r.id, code: r.code, hostId: r.host_id, status: r.status,
    questionData: JSON.parse(r.question_data || "{}"), round: r.round,
    roundTimeLeft, roundTimeTotal: ROUND_TIME_SEC,
    players: allPlayers.map(p => {
      const char = p.character ? getCharacter(p.character) : null;
      const cardData = p.card ? JSON.parse(p.card) : null;
      return {
        id: p.id, userId: p.user_id, username: p.username, score: p.score,
        alive: !!p.alive, ready: !!p.ready, guess: !!p.guess, joinedAt: p.joined_at,
        characterLocked: !!p.character_locked,
        character: char ? { id: char.id, name: char.name, emoji: char.emoji, color: char.bgGradient } : null,
        card: p.character_locked ? (cardData && !p.card_used ? { id: cardData.id, name: cardData.name, emoji: cardData.emoji, rarity: cardData.rarity, color: cardData.color, description: cardData.description } : null) : null,
        skillUsed: !!p.skill_used, cardUsed: !!p.card_used, skillCooldown: p.skill_cooldown || 0
      };
    }),
    createdAt: r.created_at
  };
}

export function getBRDistanceHint(code, userId, guess) {
  const r = db.prepare("SELECT * FROM br_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  const qd = JSON.parse(r.question_data);
  const distanceKm = haversineDistanceKm(guess.lat, guess.lng, qd.lat, qd.lng);
  return { hint: getDistanceHint(distanceKm), distanceKm };
}
