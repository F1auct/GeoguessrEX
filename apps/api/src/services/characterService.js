import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJson(filename) {
  const filePath = path.resolve(__dirname, "../data", filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

let _characters = null;
let _cards = null;

export function getCharacters() {
  if (!_characters) _characters = loadJson("characters.json");
  return _characters;
}

export function getCharacter(id) {
  return getCharacters().find(c => c.id === id) || null;
}

export function getCards() {
  if (!_cards) _cards = loadJson("cards.json");
  return _cards;
}

export function getCard(id) {
  return getCards().find(c => c.id === id) || null;
}

/** 加权随机抽卡，排除用户已永久消耗的传说卡 */
export function drawCard(userId) {
  const cards = getCards();
  const usedLegendary = db.prepare("SELECT card_id FROM user_used_cards WHERE user_id=?")
    .all(userId).map(r => r.card_id);

  const available = cards.filter(c => !usedLegendary.includes(c.id));
  if (!available.length) return cards[Math.floor(Math.random() * cards.length)];

  const totalWeight = available.reduce((s, c) => s + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const card of available) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return available[available.length - 1];
}

// ═══════════════ 角色使用追踪 ═══════════════
export function recordCharacterUsage(userId, characterId) {
  const existing = db.prepare("SELECT * FROM character_usage WHERE user_id=? AND character_id=?")
    .get(userId, characterId);
  if (existing) {
    db.prepare("UPDATE character_usage SET usage_count=usage_count+1, last_used_at=? WHERE user_id=? AND character_id=?")
      .run(new Date().toISOString(), userId, characterId);
  } else {
    db.prepare("INSERT INTO character_usage (id, user_id, character_id, usage_count, last_used_at) VALUES (?,?,?,1,?)")
      .run(crypto.randomUUID(), userId, characterId, new Date().toISOString());
  }
}

/** 获取用户最常用角色ID，若从未使用返回 null */
export function getMostUsedCharacter(userId) {
  const row = db.prepare("SELECT character_id FROM character_usage WHERE user_id=? ORDER BY usage_count DESC, last_used_at DESC LIMIT 1")
    .get(userId);
  return row?.character_id || null;
}

/** 永久消耗传说卡 */
export function consumeLegendaryCard(userId, cardId) {
  const card = getCard(cardId);
  if (!card || card.rarity !== "legendary") return;
  db.prepare("INSERT OR IGNORE INTO user_used_cards (id, user_id, card_id, used_at) VALUES (?,?,?,?)")
    .run(`${userId}_${cardId}`, userId, cardId, new Date().toISOString());
}

// ═══════════════ 大洲检测 ═══════════════
const CONTINENTS = [
  { name: "亚洲", latMin: 10, latMax: 75, lngMin: 26, lngMax: 170 },
  { name: "欧洲", latMin: 35, latMax: 71, lngMin: -25, lngMax: 40 },
  { name: "非洲", latMin: -35, latMax: 37, lngMin: -18, lngMax: 52 },
  { name: "北美洲", latMin: 15, latMax: 72, lngMin: -170, lngMax: -50 },
  { name: "南美洲", latMin: -56, latMax: 12, lngMin: -82, lngMax: -34 },
  { name: "大洋洲", latMin: -48, latMax: -5, lngMin: 110, lngMax: 180 },
];

export function detectContinent(lat, lng) {
  for (const c of CONTINENTS) {
    if (lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax) return c.name;
  }
  // rough fallback
  if (lat > 0 && lng > 20 && lng < 170) return "亚洲";
  if (lat > 35 && lng < 40 && lng > -25) return "欧洲";
  return "未知";
}

// ═══════════════ 地形检测 ═══════════════
// 基于坐标做粗略地形判断（实际应接入地形API，这里用简化逻辑）
export function detectTerrain(lat, lng) {
  const absLat = Math.abs(lat);
  // 极地地区
  if (absLat > 66) return "❄️ 极地";
  // 赤道附近
  if (absLat < 10) return "🌴 热带";
  // 通过经度区域大致判断
  if (absLat > 40) return "⛰️ 山地";
  if (absLat > 23 && absLat < 40 && Math.abs(lng) < 30) return "🏖️ 海滨";
  // 内陆 vs 沿海粗略判断
  const distFromCoast = Math.min(
    Math.abs(lng - (-120)), Math.abs(lng - 140), Math.abs(lng - 35),
    Math.abs(lng - (-15)), Math.abs(lng - 115)
  );
  if (distFromCoast < 15) return "🏖️ 海滨";
  if (absLat < 45 && absLat > 25) return "🌾 平原";
  return "🌲 森林";
}

// ═══════════════ 距离提示 ═══════════════
export function getDistanceHint(distanceKm) {
  if (distanceKm < 200) return { level: "extreme_close", emoji: "🎯", text: "极近", textEn: "Extremely Close", range: "< 200 km" };
  if (distanceKm < 1000) return { level: "close", emoji: "🏔️", text: "接近", textEn: "Close", range: "200–1000 km" };
  if (distanceKm < 3000) return { level: "medium", emoji: "🌄", text: "较远", textEn: "Medium", range: "1000–3000 km" };
  return { level: "far", emoji: "🌊", text: "极远", textEn: "Very Far", range: "> 3000 km" };
}

// ═══════════════ 角色被动：得分修正 ═══════════════
export function applyPassiveScore(characterId, baseScore, context = {}) {
  const char = getCharacter(characterId);
  if (!char) return { score: baseScore, mods: [] };

  const mods = [];
  let score = baseScore;

  switch (char.id) {
    case "explorer": {
      if (context.roundNumber <= 2) {
        score = Math.round(score * 1.15);
        mods.push({ name: "全球旅者", effect: "×1.15", newScore: score });
      }
      break;
    }
    case "hunter": {
      if (context.distanceKm < 200) {
        score = Math.round(score * 1.3);
        mods.push({ name: "狙击本能", effect: "×1.3 (近距离)", newScore: score });
      } else if (context.distanceKm > 4000) {
        score = Math.round(score * 0.8);
        mods.push({ name: "狙击本能", effect: "×0.8 (远距离)", newScore: score });
      }
      break;
    }
    case "swift": {
      if (context.isFastSubmit) {
        score = Math.round(score * 1.1);
        mods.push({ name: "疾驰", effect: "×1.1 (快速提交)", newScore: score });
      }
      break;
    }
    case "gambler": {
      const roll = Math.random();
      if (roll < 0.5) {
        score = Math.round(score * 1.4);
        mods.push({ name: "孤注一掷", effect: "🎰 ×1.4", newScore: score });
      } else {
        score = Math.round(score * 0.7);
        mods.push({ name: "孤注一掷", effect: "🎰 ×0.7", newScore: score });
      }
      break;
    }
    case "guardian": {
      // Iron Wall active skill is handled separately; passive is handled in round-end logic
      break;
    }
    case "seer": {
      // Information passive - doesn't affect score
      break;
    }
    default:
      break;
  }
  return { score: Math.min(score, 5000), mods };
}

// ═══════════════ 卡牌效果应用 ═══════════════
export function applyCardEffect(cardId, baseScore, context = {}) {
  const card = getCard(cardId);
  if (!card) return { score: baseScore, cardMod: null };

  let score = baseScore;
  const cardMod = { cardId: card.id, cardName: card.name, effect: "" };

  switch (card.effect.type) {
    case "score_floor": {
      if (score < card.effect.minScore) {
        cardMod.effect = `得分下限 ${card.effect.minScore}`;
        score = card.effect.minScore;
      }
      break;
    }
    case "guess_offset": {
      // offset applied before score calculation (handled in submit)
      cardMod.effect = `偏移 -${card.effect.offsetKm}km`;
      break;
    }
    case "perfect_score": {
      score = card.effect.score;
      cardMod.effect = "满分 5000!";
      break;
    }
    case "swap_score": {
      // handled after all scores calculated
      cardMod.effect = "分数交换";
      break;
    }
    case "rewind": {
      // handled in submit flow
      cardMod.effect = "取最高分";
      break;
    }
    default:
      break;
  }
  return { score: Math.min(score, 5000), cardMod };
}
