import crypto from "crypto";
import { db } from "./database.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { createNotification } from "./notificationService.js";
import { addXP } from "./xpService.js";
import { addSeasonXP } from "./seasonService.js";

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

// ── 创建游戏 ──

export function createGame(userId, payload) {
  const {
    title, description, gameType, region,
    requirePlayerInfo, playerInfoFields, locationTasks
  } = payload || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return { error: "游戏标题必填", status: 400 };
  }
  if (!["treasure_hunt", "reasoning"].includes(gameType)) {
    return { error: "游戏类型无效", status: 400 };
  }
  if (!Array.isArray(locationTasks) || locationTasks.length === 0) {
    return { error: "至少需要一个地点任务", status: 400 };
  }

  for (let i = 0; i < locationTasks.length; i++) {
    const task = locationTasks[i];
    if (!task.title || typeof task.title !== "string") {
      return { error: `第${i + 1}个任务标题必填`, status: 400 };
    }
    if (typeof task.targetLat !== "number" || typeof task.targetLng !== "number") {
      return { error: `第${i + 1}个任务坐标无效`, status: 400 };
    }
  }

  const gameId = crypto.randomUUID();
  const ts = nowIso();

  db.prepare(`
    INSERT INTO treasure_games (
      id, creator_id, title, description, game_type, region,
      require_player_info, player_info_fields, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)
  `).run(
    gameId, userId, title.trim(), (description || "").trim(), gameType,
    (region || "").trim(),
    requirePlayerInfo ? 1 : 0,
    JSON.stringify(playerInfoFields || []),
    ts, ts
  );

  const insertTask = db.prepare(`
    INSERT INTO location_tasks (
      id, game_id, order_index, title, description, arrival_hint,
      next_location_hint, target_lat, target_lng, task_type, task_config, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < locationTasks.length; i++) {
    const task = locationTasks[i];
    insertTask.run(
      crypto.randomUUID(), gameId, i,
      task.title.trim(), (task.description || "").trim(),
      (task.arrivalHint || "").trim(), (task.nextLocationHint || "").trim(),
      task.targetLat, task.targetLng,
      task.taskType || "gps_check",
      JSON.stringify(task.taskConfig || {}),
      ts
    );
  }

  return { game: getGameById(gameId) };
}

// ── 获取游戏详情 ──

export function getGameById(gameId) {
  const row = db.prepare(`
    SELECT g.*, u.username AS creator_username
    FROM treasure_games g
    LEFT JOIN users u ON u.id = g.creator_id
    WHERE g.id = ?
  `).get(gameId);

  if (!row) {
    return null;
  }

  const tasks = db.prepare(`
    SELECT * FROM location_tasks
    WHERE game_id = ?
    ORDER BY order_index ASC
  `).all(gameId);

  return gameRowToPublic(row, tasks);
}

function gameRowToPublic(row, tasks = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    gameType: row.game_type,
    region: row.region,
    requirePlayerInfo: !!row.require_player_info,
    playerInfoFields: safeParseJson(row.player_info_fields),
    status: row.status,
    creatorId: row.creator_id,
    creatorUsername: row.creator_username || "未知用户",
    reviewedBy: row.reviewed_by,
    reviewReason: row.review_reason,
    reviewedAt: row.reviewed_at,
    locationTasks: tasks.map((task) => ({
      id: task.id,
      orderIndex: task.order_index,
      title: task.title,
      description: task.description,
      arrivalHint: task.arrival_hint,
      nextLocationHint: task.next_location_hint,
      targetLat: task.target_lat,
      targetLng: task.target_lng,
      taskType: task.task_type,
      taskConfig: safeParseJson(task.task_config)
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ── 游戏列表（支持筛选） ──

export function listGames({ region, gameType, status } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("g.status = ?");
    params.push(status);
  } else {
    // 默认只显示已批准和进行中的游戏
    conditions.push("g.status IN ('approved', 'active', 'completed')");
  }

  if (region) {
    conditions.push("g.region = ?");
    params.push(region);
  }
  if (gameType) {
    conditions.push("g.game_type = ?");
    params.push(gameType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db.prepare(`
    SELECT g.*, u.username AS creator_username,
      (SELECT COUNT(*) FROM location_tasks WHERE game_id = g.id) AS task_count,
      (SELECT COUNT(*) FROM game_registrations WHERE game_id = g.id AND status = 'approved') AS player_count
    FROM treasure_games g
    LEFT JOIN users u ON u.id = g.creator_id
    ${where}
    ORDER BY g.created_at DESC
  `).all(...params);

  return rows.map((row) => {
    const tasks = db.prepare("SELECT * FROM location_tasks WHERE game_id = ? ORDER BY order_index ASC").all(row.id);
    return {
      ...gameRowToPublic(row, tasks),
      taskCount: row.task_count,
      playerCount: row.player_count
    };
  });
}

// ── 报名 ──

export function registerForGame(gameId, userId, playerInfo = {}) {
  const game = db.prepare("SELECT * FROM treasure_games WHERE id = ?").get(gameId);
  if (!game) {
    return { error: "游戏不存在", status: 404 };
  }
  if (!["approved", "active"].includes(game.status)) {
    return { error: "该游戏暂不接受报名", status: 400 };
  }

  const existing = db.prepare(
    "SELECT * FROM game_registrations WHERE game_id = ? AND user_id = ?"
  ).get(gameId, userId);
  if (existing) {
    return { error: "你已经报过名了", status: 409 };
  }

  if (game.creator_id === userId) {
    return { error: "不能报名自己创建的游戏", status: 400 };
  }

  const regId = crypto.randomUUID();
  const ts = nowIso();

  // 不需要玩家信息 → 自动通过并创建进度
  const autoApprove = !game.require_player_info;
  const regStatus = autoApprove ? "approved" : "pending";

  db.prepare(`
    INSERT INTO game_registrations (id, game_id, user_id, player_info, info_consented, status, created_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(regId, gameId, userId, JSON.stringify(playerInfo), regStatus, ts);

  if (autoApprove) {
    const progId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO game_progress (id, registration_id, user_id, game_id, current_step, completed_steps, started_at, updated_at)
      VALUES (?, ?, ?, ?, 0, '[]', ?, ?)
    `).run(progId, regId, userId, gameId, ts, ts);
  }

  return {
    registration: {
      id: regId,
      gameId,
      userId,
      status: "pending",
      createdAt: ts
    }
  };
}

// ── 审核报名（游戏发起方） ──

export function approveRegistration(gameId, regId, action, reviewerId) {
  const game = db.prepare("SELECT * FROM treasure_games WHERE id = ?").get(gameId);
  if (!game) {
    return { error: "游戏不存在", status: 404 };
  }
  if (game.creator_id !== reviewerId) {
    return { error: "只有游戏发起方可以审核报名", status: 403 };
  }

  const reg = db.prepare("SELECT * FROM game_registrations WHERE id = ? AND game_id = ?").get(regId, gameId);
  if (!reg) {
    return { error: "报名记录不存在", status: 404 };
  }
  if (reg.status !== "pending") {
    return { error: "该报名已处理", status: 400 };
  }

  if (!["approved", "rejected"].includes(action)) {
    return { error: "审核动作无效", status: 400 };
  }

  const ts = nowIso();
  db.prepare(
    "UPDATE game_registrations SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?"
  ).run(action, reviewerId, ts, regId);

  // 通过后创建进度记录
  if (action === "approved") {
    const progId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO game_progress (id, registration_id, user_id, game_id, current_step, completed_steps, started_at, updated_at)
      VALUES (?, ?, ?, ?, 0, '[]', ?, ?)
    `).run(progId, regId, reg.user_id, gameId, ts, ts);
    createNotification({ userId: reg.user_id, type: "reg_approved", title: "✅ 报名已通过", body: `你报名参加的「${game.title}」已通过审核，可以开始游戏了！`, link: `/games/${gameId}` });
  } else {
    createNotification({ userId: reg.user_id, type: "reg_rejected", title: "❌ 报名未通过", body: `你报名参加的「${game.title}」未通过审核`, link: `/games/${gameId}` });
  }

  return { ok: true };
}

// ── 获取报名列表 ──

export function getGameRegistrations(gameId, userId) {
  const game = db.prepare("SELECT * FROM treasure_games WHERE id = ?").get(gameId);
  if (!game) {
    return { error: "游戏不存在", status: 404 };
  }
  if (game.creator_id !== userId) {
    return { error: "只有游戏发起方可以查看报名列表", status: 403 };
  }

  const rows = db.prepare(`
    SELECT gr.*, u.username, u.email
    FROM game_registrations gr
    LEFT JOIN users u ON u.id = gr.user_id
    WHERE gr.game_id = ?
    ORDER BY gr.created_at ASC
  `).all(gameId);

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username || "未知用户",
      email: row.email || "",
      playerInfo: safeParseJson(row.player_info),
      infoConsented: !!row.info_consented,
      status: row.status,
      createdAt: row.created_at
    }))
  };
}

// ── 获取我的进度 ──

export function getMyProgress(gameId, userId) {
  const progress = db.prepare(`
    SELECT gp.*, gr.status AS reg_status
    FROM game_progress gp
    JOIN game_registrations gr ON gr.id = gp.registration_id
    WHERE gp.game_id = ? AND gp.user_id = ?
  `).get(gameId, userId);

  if (!progress) {
    return { error: "你还没有报名或未被批准参与该游戏", status: 404 };
  }

  if (progress.reg_status !== "approved") {
    return { error: "你的报名尚未被批准", status: 403 };
  }

  const game = db.prepare("SELECT * FROM treasure_games WHERE id = ?").get(gameId);
  const tasks = db.prepare("SELECT * FROM location_tasks WHERE game_id = ? ORDER BY order_index ASC").all(gameId);

  return {
    gameId,
    currentStep: progress.current_step,
    completedSteps: safeParseJson(progress.completed_steps),
    totalSteps: tasks.length,
    startedAt: progress.started_at,
    completedAt: progress.completed_at,
    // 当前步骤信息
    currentTask: tasks[progress.current_step]
      ? {
          id: tasks[progress.current_step].id,
          orderIndex: tasks[progress.current_step].order_index,
          title: tasks[progress.current_step].title,
          description: tasks[progress.current_step].description,
          arrivalHint: tasks[progress.current_step].arrival_hint,
          taskType: tasks[progress.current_step].task_type,
          taskConfig: safeParseJson(tasks[progress.current_step].task_config),
          // 到达新步骤时返回 arrival_hint
          currentHint: progress.current_step === 0 || progress.completed_at
            ? tasks[progress.current_step].arrival_hint
            : ""
        }
      : null
  };
}

// ── 完成当前步骤 ──

export function completeStep(gameId, userId, payload) {
  const progress = db.prepare(`
    SELECT gp.*, gr.status AS reg_status
    FROM game_progress gp
    JOIN game_registrations gr ON gr.id = gp.registration_id
    WHERE gp.game_id = ? AND gp.user_id = ?
  `).get(gameId, userId);

  if (!progress) {
    return { error: "你还没有参与该游戏", status: 404 };
  }
  if (progress.reg_status !== "approved") {
    return { error: "你的报名尚未被批准", status: 403 };
  }
  if (progress.completed_at) {
    return { error: "你已经完成了该游戏", status: 400 };
  }

  const tasks = db.prepare("SELECT * FROM location_tasks WHERE game_id = ? ORDER BY order_index ASC").all(gameId);
  const currentTask = tasks[progress.current_step];

  if (!currentTask) {
    return { error: "没有更多步骤", status: 400 };
  }

  // 验证当前步骤
  if (currentTask.task_type === "gps_check") {
    const { userLat, userLng } = payload || {};
    if (typeof userLat !== "number" || typeof userLng !== "number") {
      return { error: "需要提供当前位置坐标", status: 400 };
    }
    const distanceKm = haversineDistanceKm(userLat, userLng, currentTask.target_lat, currentTask.target_lng);
    const arrivalThreshold = safeParseJson(currentTask.task_config).thresholdKm || 0.1;
    if (distanceKm > arrivalThreshold) {
      return { error: `你离目标地点还有 ${distanceKm.toFixed(2)} km（要求 ${arrivalThreshold} km 以内）`, status: 400 };
    }
  } else if (currentTask.task_type === "photo_upload") {
    // 拍照验证：记录上传路径
    if (!payload?.imageUrl && !payload?.imagePath) {
      return { error: "需要上传照片", status: 400 };
    }
  }

  // 标记当前步骤完成
  const ts = nowIso();
  const completedSteps = safeParseJson(progress.completed_steps);
  completedSteps.push({
    step: progress.current_step,
    taskId: currentTask.id,
    taskTitle: currentTask.title,
    completedAt: ts,
    evidence: payload?.imageUrl || payload?.imagePath || null
  });

  const nextStep = progress.current_step + 1;
  const isComplete = nextStep >= tasks.length;

  db.prepare(`
    UPDATE game_progress
    SET current_step = ?, completed_steps = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(isComplete ? progress.current_step : nextStep, JSON.stringify(completedSteps), isComplete ? ts : null, ts, progress.id);

  // 如果全部完成
  if (isComplete) {
    db.prepare("UPDATE game_progress SET completed_at = ? WHERE id = ?").run(ts, progress.id);
    addXP(userId, 100); addSeasonXP(userId, 120);
  } else {
    addXP(userId, 20); addSeasonXP(userId, 25);
  }

  return {
    completed: true,
    isAllDone: isComplete,
    stepTitle: currentTask.title,
    nextLocationHint: isComplete ? "" : tasks[nextStep]?.next_location_hint || "",
    completedSteps
  };
}

// ── 我创建的游戏列表 ──

export function listMyGames(userId) {
  const rows = db.prepare(`
    SELECT g.*, u.username AS creator_username,
      (SELECT COUNT(*) FROM location_tasks WHERE game_id = g.id) AS task_count,
      (SELECT COUNT(*) FROM game_registrations WHERE game_id = g.id AND status = 'approved') AS player_count,
      (SELECT COUNT(*) FROM game_registrations WHERE game_id = g.id AND status = 'pending') AS pending_count
    FROM treasure_games g
    LEFT JOIN users u ON u.id = g.creator_id
    WHERE g.creator_id = ?
    ORDER BY g.created_at DESC
  `).all(userId);

  return rows.map((row) => {
    const tasks = db.prepare("SELECT * FROM location_tasks WHERE game_id = ? ORDER BY order_index ASC").all(row.id);
    const registrations = db.prepare(`
      SELECT gr.*, u.username, u.email
      FROM game_registrations gr
      LEFT JOIN users u ON u.id = gr.user_id
      WHERE gr.game_id = ?
      ORDER BY gr.created_at ASC
    `).all(row.id);

    return {
      ...gameRowToPublic(row, tasks),
      taskCount: row.task_count,
      playerCount: row.player_count,
      pendingCount: row.pending_count,
      registrations: registrations.map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username || "未知用户",
        email: r.email || "",
        playerInfo: safeParseJson(r.player_info),
        infoConsented: !!r.info_consented,
        status: r.status,
        createdAt: r.created_at
      }))
    };
  });
}

// ── 审核报名（自动通过不需要信息的） ──
