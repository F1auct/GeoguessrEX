import { db } from "./database.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { scoreFromDistance } from "../utils/scoring.js";
import { addXP } from "./xpService.js";

function nowIso() { return new Date().toISOString(); }
function cryptoId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

/** 列出所有活跃路线 */
export function listRoutes() {
  const routes = db.prepare("SELECT * FROM routes WHERE status = 'active' ORDER BY created_at").all();
  for (const r of routes) {
    r.stops = db.prepare("SELECT * FROM route_stops WHERE route_id = ? ORDER BY order_index").all(r.id);
  }
  return routes;
}

/** 获取单条路线详情（含站点） */
export function getRouteById(routeId) {
  const route = db.prepare("SELECT * FROM routes WHERE id = ?").get(routeId);
  if (!route) return null;
  route.stops = db.prepare("SELECT * FROM route_stops WHERE route_id = ? ORDER BY order_index").all(routeId);
  return route;
}

/** 开始或恢复一条路线 */
export function startRoute(userId, routeId) {
  const route = getRouteById(routeId);
  if (!route) return { error: "路线不存在", status: 404 };

  let progress = db.prepare("SELECT * FROM user_route_progress WHERE user_id = ? AND route_id = ?").get(userId, routeId);
  if (!progress) {
    db.prepare(`
      INSERT INTO user_route_progress (id, user_id, route_id, current_stop, completed_stops, total_score, started_at)
      VALUES (?, ?, ?, 0, '[]', 0, ?)
    `).run(cryptoId("urp"), userId, routeId, nowIso());
    progress = db.prepare("SELECT * FROM user_route_progress WHERE user_id = ? AND route_id = ?").get(userId, routeId);
  }

  progress.completed_stops = JSON.parse(progress.completed_stops || "[]");
  progress.route = route;
  return progress;
}

/** 获取路线进度 */
export function getProgress(userId, routeId) {
  const progress = db.prepare("SELECT * FROM user_route_progress WHERE user_id = ? AND route_id = ?").get(userId, routeId);
  if (!progress) return null;
  progress.completed_stops = JSON.parse(progress.completed_stops || "[]");
  const route = getRouteById(routeId);
  progress.route = route;
  return progress;
}

/** 获取用户所有路线进度 */
export function listMyProgress(userId) {
  const rows = db.prepare("SELECT * FROM user_route_progress WHERE user_id = ?").all(userId);
  for (const p of rows) {
    p.completed_stops = JSON.parse(p.completed_stops || "[]");
    const route = db.prepare("SELECT id, title, subtitle, difficulty, xp_reward, coin_reward FROM routes WHERE id = ?").get(p.route_id);
    p.route = route;
  }
  return rows;
}

/** 提交当前站点的猜测答案 */
export function submitStopAnswer(userId, routeId, guess) {
  if (!guess || typeof guess.lat !== "number" || typeof guess.lng !== "number") {
    return { error: "请在地图上选择位置", status: 400 };
  }

  const progress = db.prepare("SELECT * FROM user_route_progress WHERE user_id = ? AND route_id = ?").get(userId, routeId);
  if (!progress) return { error: "请先开始路线", status: 404 };
  if (progress.completed_at) return { error: "路线已完成", status: 400 };

  const completedStops = JSON.parse(progress.completed_stops || "[]");
  const currentIndex = progress.current_stop;

  const stops = db.prepare("SELECT * FROM route_stops WHERE route_id = ? ORDER BY order_index").all(routeId);
  if (currentIndex >= stops.length) return { error: "所有站点已完成", status: 400 };

  const stop = stops[currentIndex];
  const distanceKm = haversineDistanceKm(guess.lat, guess.lng, stop.lat, stop.lng);
  const score = scoreFromDistance(distanceKm);

  // 记录完成此站
  completedStops.push({
    stopIndex: currentIndex,
    stopTitle: stop.title,
    guessLat: guess.lat,
    guessLng: guess.lng,
    answerLat: stop.lat,
    answerLng: stop.lng,
    distanceKm: Math.round(distanceKm * 100) / 100,
    score,
    culturalNote: stop.cultural_note,
    completedAt: nowIso(),
  });

  const newIndex = currentIndex + 1;
  const totalScore = progress.total_score + score;
  const isComplete = newIndex >= stops.length;

  db.prepare(`
    UPDATE user_route_progress
    SET current_stop = ?, completed_stops = ?, total_score = ?,
        completed_at = ?
    WHERE user_id = ? AND route_id = ?
  `).run(newIndex, JSON.stringify(completedStops), totalScore, isComplete ? nowIso() : null, userId, routeId);

  if (isComplete) {
    const route = getRouteById(routeId);
    addXP(userId, route.xp_reward);
  }

  return {
    stop: { title: stop.title, lat: stop.lat, lng: stop.lng },
    answer: { lat: stop.lat, lng: stop.lng },
    guess: { lat: guess.lat, lng: guess.lng },
    distanceKm: Math.round(distanceKm * 100) / 100,
    score,
    totalScore,
    isComplete,
    isLastStop: isComplete,
    nextStopIndex: isComplete ? null : newIndex,
    totalStops: stops.length,
    culturalNote: stop.cultural_note,
  };
}
