import { requireAuth } from "../middleware/auth.js";
import { createRoom, getRoomByCode, joinRoom, submitPvPGuess, usePvPSkill, usePvPCard, getExplorerHint, lockPvPCharacter, checkPvPSelectTimeout } from "../services/pvpService.js";
import { getCountryQuestion, getStreakLeaderboard, submitCountryGuess,
  createBRRoom, joinBRRoom, toggleBRReady, startBRRoom, submitBRGuess, getBRRoom,
  useBRSkill, useBRCard, getBRDistanceHint, lockBRCharacter } from "../services/gameModesService.js";
import { getCharacters, getCards } from "../services/characterService.js";
import { db } from "../services/database.js";

export function registerGameModeRoutes(app) {
  // ═══ 角色/卡牌查询 ═══
  app.get("/api/characters", (req, res) => {
    try { return res.json({ items: getCharacters() }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.get("/api/cards", (req, res) => {
    try { return res.json({ items: getCards() }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.post("/api/user/character", requireAuth, (req, res) => {
    try {
      const charId = req.body?.characterId;
      const chars = getCharacters();
      if (!chars.find(c => c.id === charId)) return res.status(400).json({ error: "无效角色" });
      db.prepare("UPDATE users SET selected_character=? WHERE id=?").run(charId, req.user.id);
      return res.json({ success: true, characterId: charId });
    } catch { return res.status(500).json({ error: "保存失败" }); }
  });

  app.get("/api/user/character", requireAuth, (req, res) => {
    try {
      const user = db.prepare("SELECT selected_character FROM users WHERE id=?").get(req.user.id);
      return res.json({ characterId: user?.selected_character || "explorer" });
    } catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // ═══ PvP ═══
  app.post("/api/pvp/create", requireAuth, (req, res) => {
    try {
      const result = createRoom(req.user.id, req.body.maxRounds || 5);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(201).json(result);
    } catch { return res.status(500).json({ error: "创建失败" }); }
  });

  app.post("/api/pvp/join", requireAuth, (req, res) => {
    try {
      const result = joinRoom(req.body.code, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "加入失败" }); }
  });

  // 锁定角色
  app.post("/api/pvp/lock", requireAuth, (req, res) => {
    try {
      const result = lockPvPCharacter(req.body.code, req.user.id, req.body.characterId);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "锁定失败" }); }
  });

  // 检查超时
  app.post("/api/pvp/check-timeout", (req, res) => {
    try {
      const result = checkPvPSelectTimeout(req.body.code);
      return res.json(result || { noChange: true });
    } catch { return res.status(500).json({ error: "检查失败" }); }
  });

  app.post("/api/pvp/submit", requireAuth, (req, res) => {
    try {
      const result = submitPvPGuess(req.body.code, req.user.id, req.body.guess, req.body.options || {});
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch { return res.status(500).json({ error: "提交失败" }); }
  });

  app.post("/api/pvp/skill", requireAuth, (req, res) => {
    try { const result = usePvPSkill(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "技能使用失败" }); }
  });

  app.post("/api/pvp/card", requireAuth, (req, res) => {
    try { const result = usePvPCard(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "卡牌使用失败" }); }
  });

  app.post("/api/pvp/hint", requireAuth, (req, res) => {
    try { const result = getExplorerHint(req.body.code, req.user.id, req.body.guess); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.get("/api/pvp/room/:code", (req, res) => {
    try { const room = getRoomByCode(req.params.code); if (!room) return res.status(404).json({ error: "房间不存在" }); return res.json(room); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // ═══ Country Streak ═══
  app.get("/api/streak/question", (req, res) => {
    try { const q = getCountryQuestion(); if (!q) return res.status(404).json({ error: "无题目" }); return res.json(q); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });
  app.post("/api/streak/submit", requireAuth, (req, res) => {
    try { const result = submitCountryGuess(req.user.id, req.body); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "提交失败" }); }
  });
  app.get("/api/streak/leaderboard", (req, res) => {
    try { return res.json({ items: getStreakLeaderboard() }); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  // ═══ Battle Royale ═══
  app.post("/api/br/create", requireAuth, (req, res) => {
    try { const result = createBRRoom(req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.status(201).json(result); }
    catch { return res.status(500).json({ error: "创建失败" }); }
  });

  app.post("/api/br/join", requireAuth, (req, res) => {
    try { const result = joinBRRoom(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "加入失败" }); }
  });

  // 锁定角色
  app.post("/api/br/lock", requireAuth, (req, res) => {
    try { const result = lockBRCharacter(req.body.code, req.user.id, req.body.characterId); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "锁定失败" }); }
  });

  app.post("/api/br/ready", requireAuth, (req, res) => {
    try { const result = toggleBRReady(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "操作失败" }); }
  });

  app.post("/api/br/start", requireAuth, (req, res) => {
    try { const result = startBRRoom(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "开始失败" }); }
  });

  app.post("/api/br/submit", requireAuth, (req, res) => {
    try { const result = submitBRGuess(req.body.code, req.user.id, req.body.guess, req.body.options || {}); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "提交失败" }); }
  });

  app.post("/api/br/skill", requireAuth, (req, res) => {
    try { const result = useBRSkill(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "技能使用失败" }); }
  });

  app.post("/api/br/card", requireAuth, (req, res) => {
    try { const result = useBRCard(req.body.code, req.user.id); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "卡牌使用失败" }); }
  });

  app.post("/api/br/hint", requireAuth, (req, res) => {
    try { const result = getBRDistanceHint(req.body.code, req.user.id, req.body.guess); if (result.error) return res.status(result.status).json({ error: result.error }); return res.json(result); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });

  app.get("/api/br/room/:code", (req, res) => {
    try { const room = getBRRoom(req.params.code); if (!room) return res.status(404).json({ error: "房间不存在" }); return res.json(room); }
    catch { return res.status(500).json({ error: "获取失败" }); }
  });
}
