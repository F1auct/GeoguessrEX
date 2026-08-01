import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import GoogleStreetView from "../components/GoogleStreetView.jsx";
import AmapGuessMap from "../components/AmapGuessMap.jsx";
import CharacterPortrait from "../components/CharacterPortrait.jsx";
import CardDisplay from "../components/CardDisplay.jsx";

const API = "http://localhost:3001/api";

export default function PvPPage() {
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

  const isCreator = user?.id === room?.creatorId;
  const myChar = isCreator ? room?.creatorCharacter : room?.joinerCharacter;
  const opponentChar = isCreator ? room?.joinerCharacter : room?.creatorCharacter;
  const myCard = isCreator ? room?.creatorCard : room?.joinerCard;
  const iLocked = isCreator ? room?.creatorLocked : room?.joinerLocked;
  const bothLocked = room?.creatorLocked && room?.joinerLocked;
  const mySkillUsed = isCreator ? room?.creatorSkillUsed : room?.joinerSkillUsed;
  const iSubmitted = isCreator ? room?.creatorSubmitted : room?.joinerSubmitted;
  const bothSubmitted = room?.creatorSubmitted && room?.joinerSubmitted;
  const opponentName = isCreator ? room?.joinerName : room?.creatorName;
  const isSelecting = room?.status === "waiting" || room?.status === "selecting";

  // 加载角色/卡牌数据（用于信息展示）
  useEffect(() => {
    fetch(`${API}/characters`).then(r => r.json()).then(d => setCharacters(d.items || [])).catch(() => {});
    fetch(`${API}/cards`).then(r => r.json()).then(d => setCards(d.items || [])).catch(() => {});
  }, []);

  // 计时器
  useEffect(() => {
    if (room?.roundTimeLeft > 0 && room?.status === "playing") setTimer(room.roundTimeLeft);
    if (isSelecting && room?.selectTimeLeft > 0) setTimer(room.selectTimeLeft);
  }, [room?.roundTimeLeft, room?.selectTimeLeft, room?.status]);

  useEffect(() => {
    if (timer <= 0 || (room?.status !== "playing" && !isSelecting)) return;
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timer > 0 && (room?.status === "playing" || isSelecting)]);

  // 选择超时检查
  useEffect(() => {
    if (!isSelecting || !room?.code || bothLocked) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}/pvp/check-timeout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: room.code })
        });
        const d = await r.json();
        if (d && !d.noChange) setRoom(d);
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [isSelecting, room?.code, bothLocked]);

  useEffect(() => {
    if (room?.status === "playing") {
      const h = (e) => { e.preventDefault(); e.returnValue = ""; };
      window.addEventListener("beforeunload", h);
      return () => window.removeEventListener("beforeunload", h);
    }
  }, [room?.status]);

  // 房间轮询
  useEffect(() => {
    if (!room?.code || room.status === "finished") return;
    const t = setInterval(() => {
      fetch(`${API}/pvp/room/${room.code}`).then(r => r.json()).then(r => {
        setRoom(r);
        if (r.status === "playing" && r.creatorSubmitted && r.joinerSubmitted) {
          setSubmitted(false); setSkillUsed(false); setCardUsed(false);
          setSwiftMode(false); setSwiftMarker1(null); setSwiftMarker2(null);
          setDistanceHint(null);
        }
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [room?.code, room?.status]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ═══ 创建/加入 ═══
  async function create() {
    const r = await fetch(`${API}/pvp/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ maxRounds: 5 })
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setRoom(d.room); setError("");
  }

  async function join() {
    if (!code.trim()) { setError("请输入房间码"); return; }
    const r = await fetch(`${API}/pvp/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); return; }
    setRoom(d.room); setError("");
  }

  // ═══ 锁定角色 ═══
  async function lockCharacter(charId) {
    setSelCharId(charId);
    const r = await fetch(`${API}/pvp/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code, characterId: charId })
    });
    const d = await r.json();
    if (!r.ok) { showToast(`❌ ${d.error}`); return; }
    setRoom(d.room);
    showToast(`✅ 已锁定 ${characters.find(c => c.id === charId)?.name || charId}`);
  }

  // ═══ 技能/卡牌/提交 ═══
  async function useSkill() {
    if (!room || skillUsed || mySkillUsed) return;
    const r = await fetch(`${API}/pvp/skill`, {
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
    const r = await fetch(`${API}/pvp/card`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code })
    });
    const d = await r.json();
    if (!r.ok) { showToast(`❌ ${d.error}`); return; }
    setRoom(d.room); setCardUsed(true);
    showToast(`🃏 使用了「${d.cardData?.name}」`);
  }

  async function submitGuess() {
    if (!guess && !swiftMarker1) return;
    setSubmitted(true);
    const options = {};
    const finalGuess = guess || swiftMarker1;
    if (swiftMode && swiftMarker2) options.swiftDualGuess = swiftMarker2;
    if (cardUsed) options.cardActive = true;
    if (skillUsed) {
      if (myChar?.id === "guardian") options.skillType = "score_floor";
      if (myChar?.id === "gambler") options.skillType = "all_in";
    }

    const r = await fetch(`${API}/pvp/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: room.code, guess: finalGuess, options })
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error); setSubmitted(false); return; }
    setRoom(d.room); setGuess(null); setSwiftMarker1(null); setSwiftMarker2(null); setSwiftMode(false);
  }

  function handleMapClick(pos) {
    if (swiftMode) {
      if (!swiftMarker1) { setSwiftMarker1(pos); setGuess(pos); }
      else if (!swiftMarker2) setSwiftMarker2(pos);
      else { setSwiftMarker1(pos); setSwiftMarker2(null); setGuess(pos); }
    } else setGuess(pos);
  }

  // ═══════════════ 渲染 ═══════════════

  // 入口大厅
  if (!room) {
    return (
      <main className="mode-lobby-shell">
        <div className="mode-lobby-card">
          <div className="mode-lobby-hero">
            <span className="mode-lobby-icon">⚔️</span>
            <h1>1v1 对战</h1>
            <p>创建房间邀请好友，同题街景比拼得分。进入后选择角色，抽取卡牌，5局决胜负！</p>
          </div>
          <div className="mode-lobby-actions">
            <button className="mode-btn mode-btn-create" onClick={create}>
              <span className="mode-btn-icon">🎮</span>
              <strong>创建房间</strong>
              <span>生成房间码分享给好友</span>
            </button>
            <div className="mode-lobby-divider"><span>或输入房间码加入</span></div>
            <div className="mode-lobby-join">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="输入 6 位房间码" maxLength={6} className="mode-input" />
              <button className="mode-btn mode-btn-join" onClick={join}>加入对战</button>
            </div>
            {error ? <p className="mode-error">{error}</p> : null}
          </div>

          {/* 信息按钮 */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
            <button className="secondary-btn" onClick={() => setShowCharInfo(true)}>
              📖 查看角色技能
            </button>
            <button className="secondary-btn" onClick={() => setShowCardInfo(true)}>
              🃏 查看卡牌功能
            </button>
          </div>

          {/* 角色信息弹窗 */}
          {showCharInfo && (
            <div className="skill-toast" style={{ position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)", zIndex: 200, width: "90%", maxWidth: 700, maxHeight: "80vh", overflow: "auto", animation: "none", pointerEvents: "auto", padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>📖 角色技能一览</h2>
                <button className="ghost-btn" onClick={() => setShowCharInfo(false)} style={{ fontSize: "1.5rem" }}>×</button>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {characters.map(c => (
                  <div key={c.id} className="char-ability" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, display: "flex", gap: 12, alignItems: "start" }}>
                    <span style={{ fontSize: "2rem", width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 12, background: c.bgGradient, flexShrink: 0 }}>{c.emoji}</span>
                    <div>
                      <strong style={{ color: "#fff8ef" }}>{c.name} <span style={{ fontSize: "0.7rem", color: "rgba(255,248,239,0.5)" }}>{c.nameEn}</span></strong>
                      <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "rgba(255,248,239,0.7)" }}>{c.description}</p>
                      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                        <span style={{ fontSize: "0.8rem", color: "rgba(255,248,239,0.6)" }}>{c.passive.icon} <strong>被动·{c.passive.name}</strong>：{c.passive.description}</span>
                        <span style={{ fontSize: "0.8rem", color: "rgba(255,248,239,0.6)" }}>{c.active.icon} <strong>主动·{c.active.name}</strong>：{c.active.description}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 卡牌信息弹窗 */}
          {showCardInfo && (
            <div className="skill-toast" style={{ position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)", zIndex: 200, width: "90%", maxWidth: 700, maxHeight: "80vh", overflow: "auto", animation: "none", pointerEvents: "auto", padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>🃏 卡牌功能一览</h2>
                <button className="ghost-btn" onClick={() => setShowCardInfo(false)} style={{ fontSize: "1.5rem" }}>×</button>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {cards.map(c => (
                  <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "start", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>{c.emoji}</span>
                    <div>
                      <strong style={{ color: "#fff8ef" }}>
                        {c.name}
                        <span style={{ fontSize: "0.65rem", marginLeft: 8, padding: "2px 8px", borderRadius: 6, background: c.color, color: "#fff" }}>
                          {c.rarity === "legendary" ? "传说" : c.rarity === "epic" ? "史诗" : c.rarity === "rare" ? "稀有" : "普通"}
                        </span>
                      </strong>
                      <p style={{ margin: "4px 0", fontSize: "0.8rem", fontStyle: "italic", color: "rgba(255,248,239,0.5)" }}>"{c.flavor}"</p>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,248,239,0.75)" }}>{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ═══ 角色选择阶段 ═══
  if (isSelecting) {
    return (
      <main className="mode-lobby-shell" style={{ background: "#0d1114" }}>
        <div className="mode-lobby-card" style={{ maxWidth: 680 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <span className="mode-waiting-icon">🎭</span>
            <h2>选择你的角色</h2>
            {timer > 0 && (
              <div className={`game-timer`} style={{ position: "static", transform: "none", display: "inline-flex", margin: "8px auto" }}>
                ⏱️ {timer}s 内锁定角色
              </div>
            )}
            <p style={{ color: "rgba(255,248,239,0.55)", fontSize: "0.85rem" }}>
              对手 {opponentName || "???"} · {room.code}
              {iLocked ? " ✅ 已锁定" : bothLocked ? "" : ""}
            </p>
          </div>

          {/* 角色网格 */}
          <div className="char-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {characters.map(c => (
              <button
                key={c.id}
                className={`char-card ${selCharId === c.id ? "selected" : ""} ${iLocked ? "card-used" : ""}`}
                style={{ gridTemplateColumns: "44px 1fr", opacity: iLocked && selCharId !== c.id ? 0.4 : 1 }}
                onClick={() => !iLocked && lockCharacter(c.id)}
                disabled={iLocked}
              >
                <div className="char-card-visual" style={{ width: 44, height: 44, borderRadius: 12, background: c.bgGradient }}>
                  <span className="char-card-emoji" style={{ fontSize: "1.4rem" }}>{c.emoji}</span>
                </div>
                <div className="char-card-info">
                  <strong>{c.name}</strong>
                  <span style={{ fontSize: "0.68rem" }}>{c.passive.name} | {c.active.name}</span>
                </div>
                {selCharId === c.id && iLocked && <div className="char-card-check" style={{ top: 4, right: 6 }}>✓</div>}
              </button>
            ))}
          </div>

          {/* 对手状态 */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: room?.creatorCharacter?.color || "rgba(255,255,255,0.1)", display: "grid", placeItems: "center", fontSize: "1.4rem" }}>
                {room?.creatorCharacter?.emoji || "❓"}
              </div>
              <span style={{ fontSize: "0.7rem", color: "rgba(255,248,239,0.5)", display: "block", marginTop: 4 }}>
                {room?.creatorName} {room?.creatorLocked ? "✅" : "⏳"}
              </span>
            </div>
            <span style={{ fontSize: "1.5rem", alignSelf: "center", color: "rgba(255,255,239,0.3)" }}>VS</span>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: room?.joinerCharacter?.color || "rgba(255,255,255,0.1)", display: "grid", placeItems: "center", fontSize: "1.4rem" }}>
                {room?.joinerCharacter?.emoji || "❓"}
              </div>
              <span style={{ fontSize: "0.7rem", color: "rgba(255,248,239,0.5)", display: "block", marginTop: 4 }}>
                {room?.joinerName || "等待中"} {room?.joinerLocked ? "✅" : room?.joinerId ? "⏳" : ""}
              </span>
            </div>
          </div>

          {bothLocked && <p style={{ textAlign: "center", color: "var(--accent)", marginTop: 16 }}>双方已锁定，即将开始...</p>}
        </div>
      </main>
    );
  }

  // ═══ 比赛中 ═══
  if (room?.status === "playing") {
    const qd = room.questionData;
    return (
      <main className="play-shell">
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

        {/* 顶部 HUD */}
        <div className="pvp-hud-bar">
          <div className="pvp-hud-left">
            <span className="pvp-hud-round">第 {room.round}/{room.maxRounds} 局</span>
            <span className="pvp-hud-vs">⚔️ VS <strong>{opponentName}</strong></span>
          </div>
          <div className="pvp-hud-right">
            <span className={`pvp-hud-status ${iSubmitted ? "done" : ""}`}>
              {iSubmitted ? "✅ 已提交" : "🔍 选点中"}
            </span>
          </div>
        </div>

        {timer > 0 && <div className={`game-timer ${timer <= 10 ? "urgent" : ""}`}>⏱️ {timer}s</div>}

        {/* 左上角：卡牌（点击查看详情） */}
        <div style={{ position: "absolute", top: 90, left: 24, zIndex: 22 }}>
          {room?.creatorCard || room?.joinerCard ? (
            <div>
              <button
                className="card-mini"
                style={{ borderColor: (myCard || (isCreator ? room?.joinerCard : room?.creatorCard))?.color || "#888", background: "rgba(20,22,24,0.9)", cursor: "pointer" }}
                onClick={() => setShowCardDetail(!showCardDetail)}
              >
                <span className="card-mini-emoji">🃏</span>
                <span className="card-mini-name">{(myCard || (isCreator ? room?.joinerCard : room?.creatorCard))?.name || "卡牌"}</span>
              </button>
              {showCardDetail && (myCard || (isCreator ? room?.joinerCard : room?.creatorCard)) && (
                <div style={{ marginTop: 8 }}>
                  <CardDisplay card={myCard || (isCreator ? room?.joinerCard : room?.creatorCard)} />
                  {myCard && !cardUsed && (
                    <button className="card-use-btn" onClick={useCard} style={{ marginTop: 8, width: 220 }}>
                      使用卡牌
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* 角色侧边栏 */}
        <div className="game-hud-sidebar" style={{ top: myCard ? 190 : 90 }}>
          {myChar && (
            <div className="game-hud-card game-hud-character">
              <CharacterPortrait character={myChar} mode="chibi" size={72} />
              <div className="game-hud-char-info">
                <strong>{myChar.name}</strong>
                <span>{opponentChar ? `对手: ${opponentChar.name}` : ""}</span>
              </div>
            </div>
          )}
          <div className="game-hud-card">
            <div className="game-hud-actions">
              <button className="game-hud-skill-btn" onClick={useSkill} disabled={skillUsed || mySkillUsed || iSubmitted}>
                {mySkillUsed || skillUsed ? "✓ 技能已用" : `⚡ ${myChar?.id === "explorer" ? "鹰眼" : myChar?.id === "hunter" ? "地形锁定" : myChar?.id === "seer" ? "天启" : myChar?.id === "swift" ? "闪现" : myChar?.id === "guardian" ? "铁壁" : "全押"}`}
              </button>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="hud-bottom">
          <section className={`mini-map-dock ${mapExpanded ? "expanded" : "collapsed"}`}>
            <button className="dock-toggle" onClick={() => setMapExpanded(c => !c)}><span>{mapExpanded ? "收起地图" : "展开地图"}</span><strong>{mapExpanded ? "−" : "+"}</strong></button>
            {mapExpanded ? (
              <div className="mini-map-wrap">
                <AmapGuessMap value={swiftMode ? swiftMarker1 : guess} onChange={handleMapClick} apiKey={aKey} />
                {swiftMode && <div style={{ padding: "4px 8px", fontSize: "0.75rem", color: "var(--muted)", textAlign: "center" }}>{!swiftMarker1 ? "①" : !swiftMarker2 ? "② (可选)" : "✓ 双标记就绪"}</div>}
              </div>
            ) : null}
          </section>
          <section className="card floating-controls">
            <p>选点：<strong>{guess ? `${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}` : "未选"}</strong></p>
            {!iSubmitted ? (
              <button className="primary-btn" onClick={submitGuess} disabled={(!guess && !swiftMarker1) || submitted}>🚀 提交</button>
            ) : bothSubmitted ? <p className="pvp-waiting-text">双方已提交，加载下一局...</p> : <p className="pvp-waiting-text">等待 {opponentName} 提交...</p>}
          </section>
        </div>
      </main>
    );
  }

  // ═══ 结束 ═══
  if (room?.status === "finished") {
    const history = room.roundHistory || [];
    const totalC = history.reduce((s, h) => s + (h.creatorScore || 0), 0);
    const totalJ = history.reduce((s, h) => s + (h.joinerScore || 0), 0);
    const iWin = room.winnerId === user?.id;
    const draw = !room.winnerId;

    return (
      <main className="mode-lobby-shell">
        <div className="mode-result-card" style={{ maxWidth: 620 }}>
          <div className="mode-result-hero">
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 16 }}>
              <div style={{ textAlign: "center" }}>
                <CharacterPortrait character={room.creatorCharacter} mode="full" size={140} />
                <span style={{ display: "block", fontSize: "0.8rem", color: "rgba(255,248,239,0.6)", marginTop: 6 }}>{room.creatorName}</span>
              </div>
              <span style={{ fontSize: "2rem", alignSelf: "center", color: "rgba(255,248,239,0.3)" }}>VS</span>
              <div style={{ textAlign: "center" }}>
                <CharacterPortrait character={room.joinerCharacter} mode="full" size={140} />
                <span style={{ display: "block", fontSize: "0.8rem", color: "rgba(255,248,239,0.6)", marginTop: 6 }}>{room.joinerName}</span>
              </div>
            </div>
            <span className="mode-result-icon">{draw ? "🤝" : iWin ? "🏆" : "💪"}</span>
            <h1>{draw ? "平局！" : iWin ? "你赢了！" : "你输了"}</h1>
          </div>
          <div className="mode-result-scoreboard">
            <div className={`mode-result-player ${iWin ? "winner" : ""}`}>
              <span className="mode-result-avatar">{room.creatorName?.[0]}</span>
              <strong>{room.creatorName}</strong><span className="mode-result-score">{totalC} 分</span>
            </div>
            <span className="mode-result-vs">VS</span>
            <div className={`mode-result-player ${!iWin && !draw ? "winner" : ""}`}>
              <span className="mode-result-avatar">{room.joinerName?.[0]}</span>
              <strong>{room.joinerName}</strong><span className="mode-result-score">{totalJ} 分</span>
            </div>
          </div>
          <div className="mode-rounds">
            <h3>📋 回合明细</h3>
            {history.map((h, i) => (
              <div key={i} className="mode-round-item">
                <span className="mode-round-num">R{i + 1}</span>
                <span className={`mode-round-name ${h.creatorScore > h.joinerScore ? "won" : ""}`}>
                  {room.creatorCharacter?.emoji} {room.creatorName} {h.creatorScore}分
                </span>
                <span className={`mode-round-name ${h.joinerScore > h.creatorScore ? "won" : ""}`} style={{ textAlign: "right" }}>
                  {h.joinerScore}分 {room.joinerName} {room.joinerCharacter?.emoji}
                </span>
              </div>
            ))}
          </div>
          <div className="mode-result-actions">
            <button className="mode-btn mode-btn-create" onClick={() => { setRoom(null); setGuess(null); setSubmitted(false); }}>再来一局</button>
            <button className="secondary-btn" onClick={() => navigate("/")}>返回首页</button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
