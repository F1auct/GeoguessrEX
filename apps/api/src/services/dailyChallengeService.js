import crypto from "crypto";
import { db } from "./database.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { scoreFromDistance } from "../utils/scoring.js";
import { addXP } from "./xpService.js";
import { addSeasonXP } from "./seasonService.js";

function nowIso() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

// 每日挑战随机选题数
const QUESTIONS_PER_DAY = 3;

// 全球知名地点种子池（如果数据库没有location_pool表则使用内置种子）
const FALLBACK_POOL = [
  { title: "巴黎埃菲尔铁塔", lat: 48.8584, lng: 2.2945, heading: 180, pitch: 10, country: "法国" },
  { title: "纽约时代广场", lat: 40.7580, lng: -73.9855, heading: 270, pitch: 0, country: "美国" },
  { title: "东京涩谷十字路口", lat: 35.6595, lng: 139.7004, heading: 90, pitch: 5, country: "日本" },
  { title: "伦敦大本钟", lat: 51.5007, lng: -0.1246, heading: 135, pitch: 10, country: "英国" },
  { title: "悉尼歌剧院", lat: -33.8568, lng: 151.2153, heading: 220, pitch: 15, country: "澳大利亚" },
  { title: "罗马斗兽场", lat: 41.8902, lng: 12.4922, heading: 60, pitch: 5, country: "意大利" },
  { title: "迪拜哈利法塔", lat: 25.1972, lng: 55.2744, heading: 180, pitch: 0, country: "阿联酋" },
  { title: "北京故宫", lat: 39.9163, lng: 116.3972, heading: 0, pitch: 10, country: "中国" },
  { title: "莫斯科红场", lat: 55.7539, lng: 37.6208, heading: 90, pitch: 5, country: "俄罗斯" },
  { title: "里约基督像", lat: -22.9519, lng: -43.2105, heading: 330, pitch: 20, country: "巴西" },
  { title: "开普敦桌山", lat: -33.9628, lng: 18.4098, heading: 0, pitch: 15, country: "南非" },
  { title: "新加坡滨海湾", lat: 1.2833, lng: 103.8607, heading: 180, pitch: 5, country: "新加坡" },
  { title: "伊斯坦布尔蓝色清真寺", lat: 41.0054, lng: 28.9768, heading: 180, pitch: 10, country: "土耳其" },
  { title: "巴塞罗那圣家堂", lat: 41.4036, lng: 2.1744, heading: 0, pitch: 10, country: "西班牙" },
  { title: "柏林勃兰登堡门", lat: 52.5163, lng: 13.3777, heading: 90, pitch: 5, country: "德国" },
  { title: "曼谷大皇宫", lat: 13.7500, lng: 100.4914, heading: 180, pitch: 10, country: "泰国" },
  { title: "开罗金字塔", lat: 29.9792, lng: 31.1342, heading: 45, pitch: 10, country: "埃及" },
  { title: "威尼斯圣马可广场", lat: 45.4342, lng: 12.3388, heading: 90, pitch: 5, country: "意大利" },
  { title: "上海外滩", lat: 31.2400, lng: 121.4900, heading: 270, pitch: 5, country: "中国" },
  { title: "旧金山金门大桥", lat: 37.8199, lng: -122.4783, heading: 200, pitch: 10, country: "美国" },
  { title: "雅典卫城", lat: 37.9715, lng: 23.7257, heading: 120, pitch: 15, country: "希腊" },
  { title: "布拉格查理大桥", lat: 50.0865, lng: 14.4114, heading: 0, pitch: 5, country: "捷克" },
  { title: "阿姆斯特丹运河", lat: 52.3676, lng: 4.9041, heading: 135, pitch: 5, country: "荷兰" },
  { title: "洛杉矶好莱坞标志", lat: 34.1341, lng: -118.3215, heading: 180, pitch: 15, country: "美国" },
  { title: "香港维多利亚港", lat: 22.2890, lng: 114.1700, heading: 0, pitch: 10, country: "中国" },
  { title: "首尔景福宫", lat: 37.5796, lng: 126.9770, heading: 0, pitch: 5, country: "韩国" },
  { title: "墨西哥城宪法广场", lat: 19.4326, lng: -99.1332, heading: 45, pitch: 5, country: "墨西哥" },
  { title: "多伦多CN塔", lat: 43.6426, lng: -79.3871, heading: 135, pitch: 20, country: "加拿大" },
  { title: "布宜诺斯艾利斯方尖碑", lat: -34.6037, lng: -58.3816, heading: 90, pitch: 5, country: "阿根廷" },
  { title: "孟买印度门", lat: 18.9220, lng: 72.8347, heading: 270, pitch: 10, country: "印度" },
];

function getPool() {
  // 优先从 questions 表获取（丰富的真实街景题库，每天都有新题）
  const questions = db.prepare("SELECT lat, lng, heading, pitch, fov, description AS title FROM questions ORDER BY RANDOM()").all();
  if (questions.length >= QUESTIONS_PER_DAY) return questions;
  // 后备：daily_challenge_pool 表
  const rows = db.prepare("SELECT * FROM daily_challenge_pool").all();
  if (rows.length >= QUESTIONS_PER_DAY) return rows;
  // 最终后备：硬编码种子池
  return FALLBACK_POOL;
}

export function getOrCreateTodayChallenge() {
  const date = todayStr();
  let rows = db.prepare("SELECT * FROM daily_challenges WHERE date=?").all(date);
  if (rows.length === 0) {
    const pool = getPool();
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_DAY);
    const ts = nowIso();
    const insert = db.prepare("INSERT INTO daily_challenges (id, date, question_data, created_at) VALUES (?,?,?,?)");
    for (const q of shuffled) {
      const qd = JSON.stringify({ lat: q.lat, lng: q.lng, heading: q.heading || 0, pitch: q.pitch || 0, fov: 90, title: q.title, country: q.country || "" });
      insert.run(crypto.randomUUID(), date, qd, ts);
    }
    rows = db.prepare("SELECT * FROM daily_challenges WHERE date=?").all(date);
  }
  return rows.map(r => ({ id: r.id, ...JSON.parse(r.question_data) }));
}

export function submitDailyAnswer(userId, challengeId, guess) {
  const challenge = db.prepare("SELECT * FROM daily_challenges WHERE id=?").get(challengeId);
  if (!challenge) return { error: "挑战不存在", status: 404 };

  const existing = db.prepare("SELECT * FROM daily_challenge_submissions WHERE challenge_id=? AND user_id=?").get(challengeId, userId);
  if (existing) return { error: "该题已提交", status: 400 };

  const qd = JSON.parse(challenge.question_data);
  const distanceKm = haversineDistanceKm(guess.lat, guess.lng, qd.lat, qd.lng);
  const sc = scoreFromDistance(distanceKm);

  db.prepare("INSERT INTO daily_challenge_submissions (id, challenge_id, user_id, guess_lat, guess_lng, score, submitted_at) VALUES (?,?,?,?,?,?,?)")
    .run(crypto.randomUUID(), challengeId, userId, guess.lat, guess.lng, sc, nowIso());

  // Check-in streak
  const date = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const lastCheckin = db.prepare("SELECT * FROM check_ins WHERE user_id=? AND date=?").get(userId, yesterday);
  const todayCheckin = db.prepare("SELECT * FROM check_ins WHERE user_id=? AND date=?").get(userId, date);
  if (!todayCheckin) {
    const streak = lastCheckin ? lastCheckin.streak + 1 : 1;
    db.prepare("INSERT INTO check_ins (id, user_id, date, streak, created_at) VALUES (?,?,?,?,?)")
      .run(crypto.randomUUID(), userId, date, streak, nowIso());
    if (streak >= 7) addXP(userId, 50);
    else if (streak >= 3) addXP(userId, 20);
    addXP(userId, 10);
  }
  addXP(userId, 15);
  addSeasonXP(userId, 30);

  return {
    submission: { challengeId, distanceKm, score: sc, won: sc >= 4000, submittedAt: nowIso() },
    answer: { lat: qd.lat, lng: qd.lng }
  };
}

export function getDailyLeaderboard(date) {
  const d = date || todayStr();
  const challenges = db.prepare("SELECT id FROM daily_challenges WHERE date=?").all(d);
  if (!challenges.length) return [];
  const ids = challenges.map(c => c.id);
  return db.prepare(`
    SELECT u.id AS userId, u.username, SUM(s.score) AS totalScore, COUNT(s.id) AS completed
    FROM daily_challenge_submissions s
    JOIN users u ON u.id=s.user_id
    WHERE s.challenge_id IN (${ids.map(() => '?').join(',')})
    GROUP BY u.id ORDER BY totalScore DESC LIMIT 50
  `).all(...ids).map((r, i) => ({ rank: i + 1, userId: r.userId, username: r.username, score: r.totalScore, completed: r.completed }));
}

export function getMyTodaySubmissions(userId) {
  const challenges = db.prepare("SELECT id FROM daily_challenges WHERE date=?").all(todayStr());
  if (!challenges.length) return [];
  return challenges.map(c => {
    const s = db.prepare("SELECT * FROM daily_challenge_submissions WHERE challenge_id=? AND user_id=?").get(c.id, userId);
    return s ? { challengeId: c.id, score: s.score, submittedAt: s.submitted_at } : null;
  }).filter(Boolean);
}

export function getCheckinStreak(userId) {
  const today = db.prepare("SELECT streak FROM check_ins WHERE user_id=? AND date=?").get(userId, todayStr());
  return today?.streak || 0;
}

