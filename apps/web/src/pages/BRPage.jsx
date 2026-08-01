import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import GoogleStreetView from "../components/GoogleStreetView.jsx";
import AmapGuessMap from "../components/AmapGuessMap.jsx";
import CharacterPortrait from "../components/CharacterPortrait.jsx";
import CardDisplay from "../components/CardDisplay.jsx";

const API = "http://localhost:3001/api";

export default function BRPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const gKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const aKey = import.meta.env.VITE_AMAP_API_KEY || "";

  const [room, setRoom] = useState(null);
  const [code, setCode] = useState("");
  const [guess, setGuess] = useState(null);
  const [swiftMarker1, setSwiftMarker1] = useState(null);
  const [swiftMarker2, setSwiftMarker2] = useState(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(true);
  const [selCharId, setSelCharId] = useState("explorer");
  const [timer, setTimer] = useState(0);
  const [toast, setToast] = useState(null);
  const [skillUsed, setSkillUsed] = useState(false);
  const [cardUsed, setCardUsed] = useState(false);
  const [distanceHint, setDistanceHint] = useState(null);
  const [swiftMode, setSwiftMode] = useState(false);
  const [showCharInfo, setShowCharInfo] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [cards, setCards] = useState([]);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const timerRef = useRef(null);

  const isHost = room?.hostId === user?.id;
  const myPlayer = room?.players?.find(p => p.userId === user?.id);
  const alivePlayers = room?.players?.filter(p => p.alive) || [];
  const allReady = alivePlayers.every(p => p.ready || p.userId === room?.hostId);
  const allLocked = alivePlayers.every(p => p.characterLocked);
  const iSubmitted = !!myPlayer?.guess;
  const myChar = myPlayer?.character;
  const myCard = myPlayer?.card;
  const mySkillAvail = !myPlayer?.skillUsed && !skillUsed && !myPlayer?.skillCooldown;
  const iLocked = !!myPlayer?.characterLocked;
  const selectTimeLeft = room?.selectTimeLeft || 0;
  const selectTimeTotal = room?.selectTimeTotal || 30;

  useEffect(() => {
    fetch(`${API}/characters`).then(r => r.json()).then(d => setCharacters(d.items || [])).catch(() => {});
    fetch(`${API}/cards`).then(r => r.json()).then(d => setCards(d.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (room?.roundTimeLeft > 0 && room?.status === "playing") setTimer(room.roundTimeLeft);
  }, [room?.roundTimeLeft, room?.status]);

  useEffect(() => {
    if (timer <= 0 || room?.status !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timer > 0 && room?.status === "playing"]);

  useEffect(() => {
    if (room?.status === "playing") {
      const h = (e) => { e.preventDefault(); e.returnValue = ""; };
      window.addEventListener("beforeunload", h);
      return () => window.removeEventListener("beforeunload", h);
    }
  }, [room?.status]);

  useEffect(() => {
    if (!room?.code || room.status === "finished") return;
    const t = setInterval(() => {
      fetch(`${API}/br/room/${room.code}`).then(r => r.json()).then(r => {
        setRoom(r);
        const me = r.players?.find(p => p.userId === user?.id);
        if (!me?.guess) {
          setSubmitted(false);
          // 从服务端同步技能/卡牌使用状态，避免盲目重置
          setSkillUsed(!!me?.skillUsed);
          setCardUsed(!!me?.cardUsed);
          setSwiftMode(false); setSwiftMarker1(null); setSwiftMarker2(null);
          setDistanceHint(null);
        }
      }).catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [room?.code, room?.status]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function create() {
    const r = await fetch(`${API}/br/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({})
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setRoom(d.room); setError("");
  }

  async function join() {
    if (!code.trim()) { setError("请输入房间码"); return; }
    const r = await fetch(`${API}/br/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setRoom(d.room); setError("");
  }

  async function lockCharacter(charId) {
    setSelCharId(charId);
    const r = await fetch(`${API}/br/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code, characterId: charId })
    });
    const d = await r.json();
    if (!r.ok) { showToast(`❌ ${d.error}`); return; }
    setRoom(d.room);
    showToast(`✅ 已锁定 ${characters.find(c => c.id === charId)?.name || charId}`);
  }

  async function toggleReady() {
    setRoom(prev => prev ? { ...prev, players: prev.players.map(p => p.userId === user.id ? { ...p, ready: !p.ready } : p) } : prev);
    await fetch(`${API}/br/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code })
    });
  }

  async function start() {
    const r = await fetch(`${API}/br/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code })
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setRoom(d.room);
  }

  async function useSkill() {
    if (!room || skillUsed || !mySkillAvail) return;
    const r = await fetch(`${API}/br/skill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code })
    });
    const d = await r.json();
    if (!r.ok) { showToast(`❌ ${d.error}`); return; }
    setRoom(d.room); setSkillUsed(true);
    if (d.skillData) {
      switch (d.skillData.type) {
        case "terrain_reveal": showToast(`🔮 天启：${d.skillData.terrain}`); break;
        case "focus_area": showToast("📍 地形锁定已激活"); break;
        case "score_floor": showToast("🛡️ 铁壁：得分下限1500"); break;
        case "dual_mark": setSwiftMode(true); showToast("⚡ 放两个候选标记"); break;
        case "distance_hint": showToast("🦅 鹰眼就绪"); break;
        case "all_in": showToast("🎲 全押！"); break;
      }
    }
  }

  async function useCard() {
    if (!room || cardUsed || !myCard) return;
    const r = await fetch(`${API}/br/card`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code })
    });
    const d = await r.json();
    if (!r.ok) { showToast(`❌ ${d.error}`); return; }
    setRoom(d.room); setCardUsed(true);
    showToast(`🃏 使用了「${d.cardData?.name}」`);
  }

  async function submit() {
    if (!guess && !swiftMarker1) return;
    setSubmitted(true);
    const options = {};
    const finalGuess = guess || swiftMarker1;
    if (swiftMode && swiftMarker2) options.swiftDualGuess = swiftMarker2;
    // 优先用本地状态，后备用服务端状态（防止轮询覆盖导致技能/卡牌未生效）
    const effectiveCardUsed = cardUsed || myPlayer?.cardUsed;
    const effectiveSkillUsed = skillUsed || myPlayer?.skillUsed;
    if (effectiveCardUsed) options.cardActive = true;
    if (effectiveSkillUsed) {
      if (myChar?.id === "guardian") options.skillType = "score_floor";
      if (myChar?.id === "gambler") options.skillType = "all_in";
    }
    const r = await fetch(`${API}/br/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code, guess: finalGuess, options })
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); setSubmitted(false); return; }
    setRoom(d.room); setGuess(null); setSwiftMarker1(null); setSwiftMarker2(null); setSwiftMode(false);
  }

  const handleMapClick = useCallback((pos) => {
    if (swiftMode) {
      if (!swiftMarker1) { setSwiftMarker1(pos); setGuess(pos); }
      else if (!swiftMarker2) setSwiftMarker2(pos);
      else { setSwiftMarker1(pos); setSwiftMarker2(null); setGuess(pos); }
    } else setGuess(pos);
  }, [swiftMode, swiftMarker1, swiftMarker2]);

  // ═══════════════════ 角色/卡牌信息弹窗 ═══════════════════
  const InfoModal = ({ show, onClose, title, items, renderItem }) => {
    if (!show) return null;
    return (
      <div className="br2-modal-overlay" onClick={onClose}>
        <div className="br2-modal-card" onClick={e => e.stopPropagation()}>
          <div className="br2-modal-head">
            <h2>{title}</h2>
            <button className="br2-modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="br2-info-grid">
            {items.map(item => renderItem(item))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════ 入口 ═══════════════════
  if (!room) {
    return (
      <main className="br2-shell">
        <div className="br2-bg br2-bg-entry" />
        <div className="br2-bg-grid" />

        <div className="br2-entry-card">
          <div className="br2-entry-emblem">🔥</div>
          <div>
            <h1 className="br2-entry-title">大逃杀挑战赛</h1>
            <p className="br2-entry-subtitle">
              多人同场竞技，选择角色、抽取卡牌。每轮淘汰最低分，最后存活者获胜。
            </p>
          </div>

          <div className="br2-entry-actions">
            <button className="br2-btn-create" onClick={create}>
              <span style={{ fontSize: "1.3rem" }}>🏟️</span>
              <span>创建房间</span>
            </button>

            <div className="br2-divider">或输入房间码加入</div>

            <div className="br2-join-row">
              <input
                className="br2-input"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="输入 6 位码"
                maxLength={6}
              />
              <button className="br2-btn-join" onClick={join}>加入</button>
            </div>

            {error && <p className="br2-entry-error">{error}</p>}
          </div>

          <div className="br2-entry-links">
            <button className="br2-link-btn" onClick={() => setShowCharInfo(true)}>
              📖 角色技能
            </button>
            <button className="br2-link-btn" onClick={() => setShowCardInfo(true)}>
              🃏 卡牌功能
            </button>
          </div>
        </div>

        <InfoModal
          show={showCharInfo} onClose={() => setShowCharInfo(false)}
          title="📖 角色技能一览" items={characters}
          renderItem={c => (
            <div key={c.id} className="br2-info-item">
              <div className="br2-info-icon" style={{ background: c.bgGradient }}>{c.emoji}</div>
              <div className="br2-info-body">
                <strong>{c.name}</strong>
                <p>{c.description}</p>
                <span className="br2-info-detail">{c.passive.icon} 被动·{c.passive.name}：{c.passive.description}</span>
                <span className="br2-info-detail">{c.active.icon} 主动·{c.active.name}：{c.active.description}</span>
              </div>
            </div>
          )}
        />

        <InfoModal
          show={showCardInfo} onClose={() => setShowCardInfo(false)}
          title="🃏 卡牌功能一览" items={cards}
          renderItem={c => (
            <div key={c.id} className="br2-info-item">
              <div className="br2-info-icon" style={{ background: c.color, fontSize: "1.8rem" }}>{c.emoji}</div>
              <div className="br2-info-body">
                <strong>{c.name}
                  <span style={{ fontSize: "0.65rem", marginLeft: 8, padding: "2px 8px", borderRadius: 6, background: c.color, color: "#fff", fontWeight: 600 }}>
                    {c.rarity === "legendary" ? "传说" : c.rarity === "epic" ? "史诗" : c.rarity === "rare" ? "稀有" : "普通"}
                  </span>
                </strong>
                {c.flavor && <p style={{ fontStyle: "italic" }}>"{c.flavor}"</p>}
                <p style={{ color: "rgba(255,248,239,0.7)", fontSize: "0.84rem" }}>{c.description}</p>
              </div>
            </div>
          )}
        />
      </main>
    );
  }

  // ═══════════════════ 等候大厅 ═══════════════════
  if (room?.status === "lobby") {
    return (
      <main className="br2-shell">
        <div className="br2-bg br2-bg-lobby" />
        <div className="br2-bg-grid" />

        <div className="br2-lobby-card">
          {/* 头部 */}
          <div className="br2-lobby-header">
            <h2 className="br2-lobby-title">🏟️ 等候大厅</h2>
            <div className="br2-room-code-badge">
              <span>房间码</span>
              <strong>{room.code}</strong>
            </div>
          </div>

          {/* 角色选择 */}
          <div>
            <p className="br2-select-label">
              {iLocked ? "✅ 角色已锁定" : "选择你的角色"}
            </p>

            {selectTimeLeft > 0 && (
              <div className="br2-select-timer-bar">
                <div
                  className={`br2-select-timer-fill ${selectTimeLeft <= 10 ? "urgent" : ""}`}
                  style={{ width: `${(selectTimeLeft / selectTimeTotal) * 100}%` }}
                />
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="br2-char-grid">
                {characters.map(c => {
                  const isSelected = selCharId === c.id;
                  const locked = iLocked && isSelected;
                  return (
                    <button
                      key={c.id}
                      className={`br2-char-option ${isSelected ? "selected" : ""}`}
                      disabled={iLocked}
                      onClick={() => !iLocked && lockCharacter(c.id)}
                    >
                      {locked && <div className="br2-char-check">✓</div>}
                      <div className="br2-char-icon-wrap" style={{ background: c.bgGradient }}>
                        <span style={{ fontSize: "1.5rem" }}>{c.emoji}</span>
                      </div>
                      <span className="br2-char-name">{c.name}</span>
                      <span className="br2-char-passive">{c.passive.icon} {c.passive.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 玩家列表 */}
          <div className="br2-players-panel">
            <span className="br2-players-title">
              玩家列表 ({room.players?.length || 0} 人)
            </span>
            {(room.players || []).map((p, i) => {
              const charObj = p.character;
              return (
                <div key={p.id} className={`br2-player-row ${p.userId === user?.id ? "is-me" : ""} ${p.ready || p.userId === room.hostId ? "is-ready" : ""}`}>
                  <span className="br2-player-rank">#{i + 1}</span>
                  <div className="br2-player-char-icon" style={{ background: charObj?.bgGradient || "rgba(255,255,255,0.05)" }}>
                    {charObj ? charObj.emoji : "❓"}
                  </div>
                  <div className="br2-player-info">
                    <strong>{p.username}</strong>
                    <span>
                      {p.characterLocked ? `🔒 ${charObj?.name || ""}` : "🎭 选角中"}
                      {p.userId === room.hostId ? "  ·  👑房主" : p.ready ? "  ·  ✅已准备" : ""}
                    </span>
                  </div>
                  <div className="br2-player-badges">
                    {p.userId === room.hostId && <span className="br2-badge-host">HOST</span>}
                    <span className={`br2-badge-ready ${p.ready ? "on" : ""}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部操作 */}
          <div className="br2-lobby-footer">
            {isHost ? (
              <button
                className="br2-btn-create"
                onClick={start}
                disabled={!allLocked || !allReady || alivePlayers.length < 2}
              >
                {!allLocked ? "⏳ 等待所有人锁定角色…" : !allReady ? "⏳ 等待所有人准备…" : `🚀 开始比赛 (${alivePlayers.length}人)`}
              </button>
            ) : (
              <button
                className={`br2-btn-ready ${myPlayer?.ready ? "is-ready" : ""}`}
                onClick={toggleReady}
                disabled={!iLocked}
              >
                {!iLocked ? "🔒 请先锁定角色" : myPlayer?.ready ? "✅ 已准备（点击取消）" : "🎯 准备就绪"}
              </button>
            )}
            <button className="br2-btn-leave" onClick={() => { setRoom(null); }}>退出房间</button>
          </div>
        </div>
      </main>
    );
  }

  // ═══════════════════ 比赛中 ═══════════════════
  if (room?.status === "playing") {
    const qd = room.questionData;
    const submittedCount = alivePlayers.filter(p => p.guess).length;
    const totalAlive = alivePlayers.length;

    return (
      <main className="play-shell">
        <div className="br2-bg br2-bg-playing" />
        <GoogleStreetView lat={qd.lat} lng={qd.lng} heading={qd.heading} pitch={qd.pitch} fov={qd.fov} apiKey={gKey} />
        <div className="streetview-vignette" />

        {toast && <div className="skill-toast">{toast}</div>}
        {distanceHint && (
          <div className="distance-hint-panel">
            <button className="distance-hint-close" onClick={() => setDistanceHint(null)}>×</button>
            <span className="distance-hint-emoji">{distanceHint.emoji}</span>
            <div className="distance-hint-level">{distanceHint.text}</div>
            <div className="distance-hint-range">{distanceHint.range}</div>
          </div>
        )}

        {/* ── 顶部 HUD 栏 (集成计时器，无遮挡) ── */}
        <div className="br2-hud-top">
          <div className="br2-hud-top-left">
            <span className="br2-hud-round-badge">第 {room.round} 轮</span>
            <span className="br2-hud-alive-badge">
              🔥 存活 <strong>{totalAlive}</strong> 人
            </span>
          </div>

          {/* 计时器 — 集成在顶栏中央 */}
          {timer > 0 && (
            <div className={`br2-hud-timer ${timer <= 10 ? "urgent" : ""}`}>
              ⏱ {timer}s
            </div>
          )}

          <div className="br2-hud-top-right">
            <span className={`br2-hud-status-tag ${
              !myPlayer?.alive ? "dead" : iSubmitted ? "submitted" : "guessing"
            }`}>
              {myPlayer?.alive ? (iSubmitted ? "✅ 已提交" : "🔍 选点中") : "💀 已淘汰"}
            </span>
            <span className="br2-hud-submitted-count">
              {submittedCount}/{totalAlive} 已提交
            </span>
          </div>
        </div>

        {/* ── 左侧面板：卡牌 + 角色信息 ── */}
        {myPlayer?.alive && (
          <div className="br2-left-panel">
            {/* 卡牌芯片 */}
            {myCard && (
              <div>
                <button
                  className="br2-card-chip"
                  style={{ borderColor: myCard.color || "#999", width: "100%" }}
                  onClick={() => setShowCardDetail(!showCardDetail)}
                >
                  <span className="br2-card-chip-emoji">{myCard.emoji}</span>
                  <span>{myCard.name}</span>
                </button>
                {showCardDetail && (
                  <div className="br2-card-detail-panel" style={{ marginTop: 8 }}>
                    <CardDisplay card={myCard} />
                    {!cardUsed && !myPlayer?.cardUsed && (
                      <button className="br2-card-use-btn" onClick={useCard}>
                        🃏 使用卡牌
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 角色信息卡 */}
            {myChar && (
              <div className="br2-char-panel">
                {/* 头像+名字+被动 */}
                <div className="br2-char-header">
                  <div
                    className="br2-char-avatar"
                    style={{ background: myChar.color || myChar.bgGradient || "#444" }}
                  >
                    {myChar.emoji}
                  </div>
                  <div className="br2-char-meta">
                    <span className="br2-char-meta-name">{myChar.name}</span>
                    <span className="br2-char-meta-passive">
                      {myChar.passive?.icon} {myChar.passive?.name}
                    </span>
                  </div>
                </div>

                {/* 被动描述标签 */}
                <div className="br2-passive-tag">
                  {myChar.passive?.description || "被动就绪"}
                </div>

                {/* 技能按钮 */}
                <button
                  className="br2-skill-btn"
                  onClick={useSkill}
                  disabled={!mySkillAvail || iSubmitted}
                >
                  {myPlayer?.skillUsed || skillUsed ? (
                    <>✓ 技能已使用</>
                  ) : myPlayer?.skillCooldown > 0 ? (
                    <>⏳ 冷却中 ({myPlayer.skillCooldown}轮)</>
                  ) : (
                    <>
                      <span className="br2-skill-btn-icon">{myChar.active?.icon || "⚡"}</span>
                      {myChar.active?.name || "技能"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 底部操作栏 (地图 + 提交) ── */}
        {myPlayer?.alive ? (
          <div className="br2-bottom-bar">
            <section className={`mini-map-dock ${mapExpanded ? "expanded" : "collapsed"}`}>
              <button className="dock-toggle" onClick={() => setMapExpanded(c => !c)}>
                <span>{mapExpanded ? "收起地图" : "展开地图"}</span>
                <strong style={{ color: "var(--ink)" }}>{mapExpanded ? "−" : "+"}</strong>
              </button>
              {mapExpanded && (
                <div className="mini-map-wrap">
                  <AmapGuessMap
                    value={swiftMode ? swiftMarker1 : guess}
                    onChange={handleMapClick}
                    apiKey={aKey}
                  />
                  {swiftMode && (
                    <div style={{ padding: "5px 10px", fontSize: "0.78rem", color: "#5b625a", textAlign: "center", fontWeight: 600 }}>
                      {!swiftMarker1 ? "① 放置第一个标记" : !swiftMarker2 ? "② 放置第二个标记 (可选)" : "✓ 双标记就绪"}
                    </div>
                  )}
                </div>
              )}
            </section>
            <section className="card floating-controls">
              <p style={{ color: "var(--ink)", fontWeight: 500 }}>
                选点：<strong>{guess ? `${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}` : "未选"}</strong>
              </p>
              {!iSubmitted ? (
                <button className="primary-btn" onClick={submit} disabled={(!guess && !swiftMarker1) || submitted}>
                  🚀 提交猜测
                </button>
              ) : (
                <p style={{ color: "var(--muted)", fontWeight: 600, margin: 0 }}>等待本轮结算…</p>
              )}
              <div style={{ marginTop: 6, fontSize: "0.85rem", color: "var(--ink)", fontWeight: 700 }}>
                总分：{myPlayer?.score || 0}
              </div>
            </section>
          </div>
        ) : (
          <div className="br2-eliminated">
            <div className="br2-eliminated-card">
              <h2>💀 你已被淘汰</h2>
              <p>存活 {totalAlive} 人，正在观战…</p>
              <div className="br2-eliminated-players">
                {alivePlayers.map(p => (
                  <div key={p.id} className="br2-eliminated-player-chip">
                    {p.character && <CharacterPortrait character={p.character} mode="icon" size={16} />}
                    <span>{p.username}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ═══════════════════ 结束 ═══════════════════
  if (room?.status === "finished") {
    const winner = room.players?.find(p => p.alive);
    const sorted = [...(room.players || [])].sort((a, b) => b.score - a.score);

    return (
      <main className="br2-shell">
        <div className="br2-bg br2-bg-lobby" />
        <div className="br2-bg-grid" />

        <div className="br2-result-card">
          {/* 获胜者 */}
          <div className="br2-result-winner">
            {winner?.character && (
              <div style={{ marginBottom: 4 }}>
                <CharacterPortrait character={winner.character} mode="full" size={140} animated />
              </div>
            )}
            <span className="br2-result-trophy">🏆</span>
            <h1>{winner?.username} 获胜！</h1>
            <span className="br2-result-winner-char">
              {winner?.character?.emoji} {winner?.character?.name}
            </span>
            <span className="br2-result-xp">+150 XP</span>
          </div>

          {/* 排名 */}
          <div>
            <div className="br2-ranking-title">📊 最终排名</div>
            <div className="br2-ranking-list">
              {sorted.map((p, i) => {
                const posCls = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                return (
                  <div key={p.id} className="br2-ranking-row">
                    <div className={`br2-ranking-pos ${posCls}`}>{medal}</div>
                    <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", fontSize: "0.85rem", flexShrink: 0, background: p.character?.bgGradient || "rgba(255,255,255,0.05)" }}>
                      {p.character ? p.character.emoji : "❓"}
                    </div>
                    <span className="br2-ranking-name">
                      <strong>{p.username}</strong> {p.alive ? "🏆" : "💀"}
                    </span>
                    <span className="br2-ranking-score">{p.score}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="br2-result-actions">
            <button className="br2-btn-create" onClick={() => { setRoom(null); setGuess(null); }} style={{ width: "auto", padding: "14px 32px" }}>
              再来一局
            </button>
            <button className="br2-btn-ready" onClick={() => navigate("/")} style={{ width: "auto", padding: "14px 32px" }}>
              返回首页
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
