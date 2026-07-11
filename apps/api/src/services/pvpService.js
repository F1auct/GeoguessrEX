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
const SELECT_TIMEOUT_SEC = 30; // 角色选择时限

function nowIso() { return new Date().toISOString(); }
function genCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

export function createRoom(userId, maxRounds = 5) {
  const q = db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT 1").get();
  if (!q) return { error: "无可用题目", status: 500 };

  // 房主抽卡（角色等锁定后再记录）
  const card = drawCard(userId);

  const id = crypto.randomUUID(), code = genCode();
  db.prepare(`INSERT INTO pvp_rooms (id,code,creator_id,status,question_data,round,max_rounds,round_history,creator_card,creator_card_used,creator_skill_used,creator_guess_count,round_started_at,select_deadline,created_at)
    VALUES (?,?,?,'waiting',?,1,?,'[]',?,0,0,0,?,?,?)`)
    .run(id, code, userId,
      JSON.stringify({ lat: q.lat, lng: q.lng, heading: q.heading || 0, pitch: q.pitch || 0, fov: q.fov || 90, title: q.description || "" }),
      maxRounds, JSON.stringify(card), null, nowIso(), nowIso());

  return { room: getRoomByCode(code) };
}

export function getRoomByCode(code) {
  const r = db.prepare(`SELECT r.*, c.username AS creator_name, j.username AS joiner_name
    FROM pvp_rooms r LEFT JOIN users c ON c.id=r.creator_id LEFT JOIN users j ON j.id=r.joiner_id WHERE r.code=?`).get(code);
  if (!r) return null;

  const history = JSON.parse(r.round_history || "[]");
  const creatorChar = r.creator_character ? getCharacter(r.creator_character) : null;
  const joinerChar = r.joiner_character ? getCharacter(r.joiner_character) : null;
  const creatorCard = r.creator_card ? JSON.parse(r.creator_card) : null;
  const joinerCard = r.joiner_card ? JSON.parse(r.joiner_card) : null;

  let roundTimeLeft = 0;
  if (r.status === "playing" && r.round_started_at) {
    const elapsed = (Date.now() - new Date(r.round_started_at).getTime()) / 1000;
    roundTimeLeft = Math.max(0, Math.ceil(ROUND_TIME_SEC - elapsed));
  }

  let selectTimeLeft = 0;
  if ((r.status === "waiting" || r.status === "selecting") && r.select_deadline) {
    selectTimeLeft = Math.max(0, Math.ceil((new Date(r.select_deadline).getTime() - Date.now()) / 1000));
  }

  return {
    id: r.id, code: r.code, creatorId: r.creator_id, creatorName: r.creator_name,
    joinerId: r.joiner_id, joinerName: r.joiner_name,
    status: r.status, questionData: JSON.parse(r.question_data || "{}"),
    creatorSubmitted: !!r.creator_guess, joinerSubmitted: !!r.joiner_guess,
    winnerId: r.winner_id, round: r.round, maxRounds: r.max_rounds,
    roundHistory: r.status === "finished" ? history : [],
    // 角色信息
    creatorCharacter: creatorChar ? { id: creatorChar.id, name: creatorChar.name, emoji: creatorChar.emoji, color: creatorChar.bgGradient } : null,
    joinerCharacter: joinerChar ? { id: joinerChar.id, name: joinerChar.name, emoji: joinerChar.emoji, color: joinerChar.bgGradient } : null,
    creatorLocked: !!r.creator_locked, joinerLocked: !!r.joiner_locked,
    // 卡牌（锁定后才可见）
    creatorCard: r.creator_locked ? (creatorCard && !r.creator_card_used ? { id: creatorCard.id, name: creatorCard.name, emoji: creatorCard.emoji, rarity: creatorCard.rarity, color: creatorCard.color, description: creatorCard.description } : null) : null,
    joinerCard: r.joiner_locked ? (joinerCard && !r.joiner_card_used ? { id: joinerCard.id, name: joinerCard.name, emoji: joinerCard.emoji, rarity: joinerCard.rarity, color: joinerCard.color, description: joinerCard.description } : null) : null,
    creatorSkillUsed: !!r.creator_skill_used,
    joinerSkillUsed: !!r.joiner_skill_used,
    // 时限
    roundTimeLeft, roundTimeTotal: ROUND_TIME_SEC,
    selectTimeLeft, selectTimeTotal: SELECT_TIMEOUT_SEC,
    createdAt: r.created_at
  };
}

export function joinRoom(code, userId) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(code);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "waiting") return { error: "房间已开始或已满", status: 400 };
  if (r.creator_id === userId) return { error: "不能加入自己的房间", status: 400 };

  // 加入者抽卡
  const card = drawCard(userId);
  const deadline = new Date(Date.now() + SELECT_TIMEOUT_SEC * 1000).toISOString();

  db.prepare(`UPDATE pvp_rooms SET joiner_id=?, joiner_card=?, status='selecting', select_deadline=? WHERE id=?`)
    .run(userId, JSON.stringify(card), deadline, r.id);

  return { room: getRoomByCode(code) };
}

/** 锁定角色选择 */
export function lockPvPCharacter(roomCode, userId, characterId) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(roomCode);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "waiting" && r.status !== "selecting") return { error: "当前阶段不可选角", status: 400 };

  const char = getCharacter(characterId);
  if (!char) return { error: "无效角色", status: 400 };

  const isCreator = userId === r.creator_id;
  const isJoiner = userId === r.joiner_id;
  if (!isCreator && !isJoiner) return { error: "不在房间中", status: 403 };

  if (isCreator && !r.creator_locked) {
    db.prepare("UPDATE pvp_rooms SET creator_character=?, creator_locked=1 WHERE id=?").run(characterId, r.id);
  } else if (isJoiner && !r.joiner_locked) {
    db.prepare("UPDATE pvp_rooms SET joiner_character=?, joiner_locked=1 WHERE id=?").run(characterId, r.id);
  } else {
    return { error: "已锁定或不在房间中", status: 400 };
  }

  // 记录使用
  recordCharacterUsage(userId, characterId);

  // 检查双方是否都锁定
  const updated = db.prepare("SELECT * FROM pvp_rooms WHERE id=?").get(r.id);
  if (updated.creator_locked && updated.joiner_locked) {
    startPvPGame(updated);
  }

  return { room: getRoomByCode(roomCode), locked: true };
}

/** 自动结算：超时未锁定则自动选择 */
export function checkPvPSelectTimeout(roomCode) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(roomCode);
  if (!r || r.status === "finished" || r.status === "playing") return null;
  if (!r.select_deadline) return null;

  if (new Date(r.select_deadline).getTime() > Date.now()) return null;

  // 超时，自动选择
  if (!r.creator_locked) {
    const autoChar = getMostUsedCharacter(r.creator_id) || getRandomCharacterId();
    db.prepare("UPDATE pvp_rooms SET creator_character=?, creator_locked=1 WHERE id=?").run(autoChar, r.id);
    recordCharacterUsage(r.creator_id, autoChar);
  }
  if (r.joiner_id && !r.joiner_locked) {
    const autoChar = getMostUsedCharacter(r.joiner_id) || getRandomCharacterId();
    db.prepare("UPDATE pvp_rooms SET joiner_character=?, joiner_locked=1 WHERE id=?").run(autoChar, r.id);
    recordCharacterUsage(r.joiner_id, autoChar);
  }

  const updated = db.prepare("SELECT * FROM pvp_rooms WHERE id=?").get(r.id);
  if (updated.creator_locked && updated.joiner_locked) {
    startPvPGame(updated);
  }

  return getRoomByCode(roomCode);
}

function getRandomCharacterId() {
  const chars = ["explorer", "hunter", "seer", "swift", "guardian", "gambler"];
  return chars[Math.floor(Math.random() * chars.length)];
}

function startPvPGame(room) {
  db.prepare("UPDATE pvp_rooms SET status='playing', round_started_at=?, select_deadline=NULL WHERE id=?")
    .run(nowIso(), room.id);
}

// ═══ 以下函数保持不变（usePvPSkill, usePvPCard, submitPvPGuess 等） ═══

export function usePvPSkill(roomCode, userId) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(roomCode);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "playing") return { error: "对局未开始", status: 400 };

  const isCreator = userId === r.creator_id;
  const skillUsed = isCreator ? r.creator_skill_used : r.joiner_skill_used;
  if (skillUsed) return { error: "技能已使用", status: 400 };

  const charId = isCreator ? r.creator_character : r.joiner_character;
  const char = getCharacter(charId);
  if (!char || char.active.usesPerGame <= 0) return { error: "角色无可用技能", status: 400 };

  if (isCreator) {
    db.prepare("UPDATE pvp_rooms SET creator_skill_used=1 WHERE id=?").run(r.id);
  } else {
    db.prepare("UPDATE pvp_rooms SET joiner_skill_used=1 WHERE id=?").run(r.id);
  }

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

  return { skillUsed: true, skillData, room: getRoomByCode(roomCode) };
}

export function usePvPCard(roomCode, userId) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(roomCode);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "playing") return { error: "对局未开始", status: 400 };

  const isCreator = userId === r.creator_id;
  const cardUsed = isCreator ? r.creator_card_used : r.joiner_card_used;
  if (cardUsed) return { error: "卡牌已使用", status: 400 };

  const cardJson = isCreator ? r.creator_card : r.joiner_card;
  if (!cardJson) return { error: "无可用卡牌", status: 400 };
  const card = JSON.parse(cardJson);

  if (isCreator) {
    db.prepare("UPDATE pvp_rooms SET creator_card_used=1 WHERE id=?").run(r.id);
  } else {
    db.prepare("UPDATE pvp_rooms SET joiner_card_used=1 WHERE id=?").run(r.id);
  }

  const cardObj = getCard(card.id);
  if (cardObj && cardObj.rarity === "legendary") {
    consumeLegendaryCard(userId, card.id);
  }

  return { cardUsed: true, cardData: card, room: getRoomByCode(roomCode) };
}

export function submitPvPGuess(roomCode, userId, guess, options = {}) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(roomCode);
  if (!r) return { error: "房间不存在", status: 404 };
  if (r.status !== "playing") return { error: "对局未开始", status: 400 };

  const qd = JSON.parse(r.question_data);
  const isCreator = userId === r.creator_id;
  const charId = isCreator ? r.creator_character : r.joiner_character;
  const char = getCharacter(charId);

  let finalGuess = guess;
  if (options.swiftDualGuess && char?.id === "swift") {
    const d1 = haversineDistanceKm(guess.lat, guess.lng, qd.lat, qd.lng);
    const d2 = options.swiftDualGuess
      ? haversineDistanceKm(options.swiftDualGuess.lat, options.swiftDualGuess.lng, qd.lat, qd.lng)
      : Infinity;
    if (d2 < d1) finalGuess = options.swiftDualGuess;
  }

  let distanceKm = haversineDistanceKm(finalGuess.lat, finalGuess.lng, qd.lat, qd.lng);

  if (options.cardEffect === "guess_offset") {
    distanceKm = Math.max(0, distanceKm - 50);
  }

  let score = scoreFromDistance(distanceKm);

  if (options.skillType === "score_floor") {
    score = Math.max(score, 1500);
  }

  const isFastSubmit = r.round_started_at
    ? (Date.now() - new Date(r.round_started_at).getTime()) / 1000 < ROUND_TIME_SEC / 2
    : false;

  const passive = applyPassiveScore(charId, score, {
    roundNumber: r.round, distanceKm, isFastSubmit
  });

  score = passive.score;

  if (options.cardActive) {
    const cardJson = isCreator ? r.creator_card : r.joiner_card;
    if (cardJson) {
      const card = JSON.parse(cardJson);
      const cardResult = applyCardEffect(card.id, score);
      score = cardResult.score;
    }
  }

  const guessJson = JSON.stringify({ lat: finalGuess.lat, lng: finalGuess.lng });

  if (isCreator && !r.creator_guess) {
    db.prepare("UPDATE pvp_rooms SET creator_guess=?, creator_score=?, creator_guess_count=creator_guess_count+1 WHERE id=?")
      .run(guessJson, score, r.id);
  } else if (!isCreator && !r.joiner_guess) {
    db.prepare("UPDATE pvp_rooms SET joiner_guess=?, joiner_score=?, joiner_guess_count=joiner_guess_count+1 WHERE id=?")
      .run(guessJson, score, r.id);
  } else if (options.isRewind) {
    if (isCreator) {
      const prevScore = r.creator_score || 0;
      if (score > prevScore) {
        db.prepare("UPDATE pvp_rooms SET creator_guess=?, creator_score=? WHERE id=?").run(guessJson, score, r.id);
      }
    } else {
      const prevScore = r.joiner_score || 0;
      if (score > prevScore) {
        db.prepare("UPDATE pvp_rooms SET joiner_guess=?, joiner_score=? WHERE id=?").run(guessJson, score, r.id);
      }
    }
  } else {
    return { error: "你已提交或不在房间中", status: 400 };
  }

  const room = db.prepare("SELECT * FROM pvp_rooms WHERE id=?").get(r.id);
  if (room.creator_guess && room.joiner_guess) {
    return resolvePvPRound(room);
  }

  return { room: getRoomByCode(roomCode), submitted: true, score, distanceKm };
}

function resolvePvPRound(room) {
  const history = JSON.parse(room.round_history || "[]");
  let creatorScore = room.creator_score;
  let joinerScore = room.joiner_score;

  history.push({
    round: room.round, creatorScore, joinerScore,
    title: JSON.parse(room.question_data).title || ""
  });

  if (room.round >= room.max_rounds) {
    const cScores = history.map(h => h.creatorScore);
    const jScores = history.map(h => h.joinerScore);

    if (room.creator_character && getCharacter(room.creator_character)?.id === "guardian" && cScores.length > 1) {
      const maxC = Math.max(...cScores);
      const minIdx = cScores.indexOf(Math.min(...cScores));
      cScores[minIdx] = maxC;
    }
    if (room.joiner_character && getCharacter(room.joiner_character)?.id === "guardian" && jScores.length > 1) {
      const maxJ = Math.max(...jScores);
      const minIdx = jScores.indexOf(Math.min(...jScores));
      jScores[minIdx] = maxJ;
    }

    const totalCreator = cScores.reduce((s, v) => s + v, 0);
    const totalJoiner = jScores.reduce((s, v) => s + v, 0);
    const winnerId = totalCreator > totalJoiner ? room.creator_id
      : totalJoiner > totalCreator ? room.joiner_id : null;

    db.prepare("UPDATE pvp_rooms SET status='finished', winner_id=?, round_history=? WHERE id=?")
      .run(winnerId, JSON.stringify(history), room.id);

    if (winnerId) { addXP(winnerId, 80); addSeasonXP(winnerId, 100); }
    addXP(room.creator_id, 30); addSeasonXP(room.creator_id, 40);
    if (room.joiner_id) { addXP(room.joiner_id, 30); addSeasonXP(room.joiner_id, 40); }
  } else {
    const q = db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT 1").get();
    if (q) {
      db.prepare(`UPDATE pvp_rooms SET question_data=?, creator_guess=NULL, joiner_guess=NULL,
        creator_score=NULL, joiner_score=NULL, round=round+1,
        creator_skill_used=0, joiner_skill_used=0,
        creator_guess_count=0, joiner_guess_count=0,
        round_history=?, round_started_at=? WHERE id=?`)
        .run(JSON.stringify({ lat: q.lat, lng: q.lng, heading: q.heading || 0, pitch: q.pitch || 0, fov: q.fov || 90, title: q.description || "" }),
          JSON.stringify(history), nowIso(), room.id);
    }
  }

  return { room: getRoomByCode(room.code), roundResolved: true };
}

export function getExplorerHint(roomCode, userId, guess) {
  const r = db.prepare("SELECT * FROM pvp_rooms WHERE code=?").get(roomCode);
  if (!r) return { error: "房间不存在", status: 404 };
  const qd = JSON.parse(r.question_data);
  const distanceKm = haversineDistanceKm(guess.lat, guess.lng, qd.lat, qd.lng);
  return { hint: getDistanceHint(distanceKm), distanceKm };
}
