import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import GoogleStreetView from "../components/GoogleStreetView.jsx";
import AmapGuessMap from "../components/AmapGuessMap.jsx";
import AmapResultMap from "../components/AmapResultMap.jsx";
import { fetchRoutes, startRoute, fetchRouteProgress, submitRouteAnswer } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001";

export default function WorldTourPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const amapApiKey = import.meta.env.VITE_AMAP_API_KEY || "";

  // View state: "list" | "detail" | "playing" | "result"
  const [view, setView] = useState("list");
  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [progress, setProgress] = useState(null);
  const [currentStop, setCurrentStop] = useState(null);
  const [guess, setGuess] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadRoutes() {
    try {
      const data = await fetchRoutes();
      setRoutes(data.items || []);
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  useEffect(() => { loadRoutes(); }, []);

  async function handleSelectRoute(route) {
    setActiveRoute(route);
    setStatus("loading");
    try {
      const prog = await fetchRouteProgress(route.id, token);
      if (prog.started && !prog.completed_at) {
        // Resume existing progress
        setProgress(prog);
        const stops = prog.route?.stops || route.stops;
        setCurrentStop(stops[prog.current_stop] || null);
        setView("playing");
      } else if (prog.completed_at) {
        setProgress(prog);
        setView("detail");
      } else {
        setProgress(null);
        setView("detail");
      }
      setStatus("ready");
    } catch (err) {
      setStatus("ready");
      setView("detail");
    }
  }

  async function handleStart() {
    if (!activeRoute) return;
    setStatus("loading");
    try {
      const prog = await startRoute(activeRoute.id, token);
      if (prog.error) { setError(prog.error); setStatus("ready"); return; }
      setProgress(prog);
      setCurrentStop(prog.route.stops[0]);
      setLastResult(null);
      setGuess(null);
      setView("playing");
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("ready");
    }
  }

  async function handleSubmit() {
    if (!activeRoute || !guess) return;
    setStatus("submitting");
    try {
      const result = await submitRouteAnswer(activeRoute.id, guess, token);
      setLastResult(result);
      setView("result");
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("ready");
    }
  }

  function handleNextStop() {
    if (!lastResult || !activeRoute) return;
    if (lastResult.isComplete) {
      setView("complete");
      return;
    }
    const stops = activeRoute.stops;
    setCurrentStop(stops[lastResult.nextStopIndex]);
    setLastResult(null);
    setGuess(null);
    setMapExpanded(false);
    setView("playing");
    fetchRouteProgress(activeRoute.id, token).then(p => setProgress(p)).catch(() => {});
    setStatus("ready");
  }

  function handleBackToList() {
    setView("list");
    setActiveRoute(null);
    setProgress(null);
    setCurrentStop(null);
    setLastResult(null);
    setGuess(null);
    loadRoutes();
  }

  const routeCoverImages = {
    route_silk_road: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
    route_pacific_ring: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
    route_european_castles: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=800&q=80",
  };

  const diffLabel = { easy: "初级", medium: "中级", hard: "高级" };

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <main className="landing-shell landing-shell-cinematic">
        <div className="auth-backdrop card page-backdrop" />
        <section className="landing-panel" style={{ maxWidth: 1100 }}>
          <div className="landing-copy">
            <p className="hero-kicker">🌍 环球之旅</p>
            <h1 className="display-title">
              <span>Choose your journey.</span>
              <span>Explore the world.</span>
            </h1>
          </div>

          {status === "loading" ? (
            <div className="status-shell">正在加载路线...</div>
          ) : status === "error" ? (
            <div className="status-shell">加载失败：{error}</div>
          ) : (
            <div className="card-grid" style={{ marginTop: 32, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {routes.map(route => (
                <div key={route.id} className="card" style={{ cursor: "pointer", overflow: "hidden" }} onClick={() => handleSelectRoute(route)}>
                  <div style={{
                    height: 180, backgroundImage: `url(${routeCoverImages[route.id] || route.cover_image})`,
                    backgroundSize: "cover", backgroundPosition: "center",
                  }} />
                  <div style={{ padding: 20 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <span className="badge">{diffLabel[route.difficulty] || route.difficulty}</span>
                      <span className="badge">{route.stops?.length || 0} 站</span>
                      <span className="badge" style={{ background: "var(--accent)", color: "#fff" }}>+{route.xp_reward} XP</span>
                    </div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1.3rem" }}>{route.title}</h3>
                    <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0 0 8px 0" }}>{route.subtitle}</p>
                    <p style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{route.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  // ── DETAIL VIEW ──
  if (view === "detail" && activeRoute) {
    const stops = activeRoute.stops || [];
    const alreadyCompleted = progress?.completed_at;
    return (
      <main className="landing-shell landing-shell-cinematic">
        <div className="auth-backdrop card page-backdrop" />
        <section className="landing-panel" style={{ maxWidth: 900 }}>
          <button className="secondary-btn" style={{ marginBottom: 16 }} onClick={handleBackToList}>← 返回路线列表</button>

          <div className="landing-copy">
            <p className="hero-kicker">{activeRoute.subtitle}</p>
            <h1 style={{ fontSize: "2rem", margin: 0 }}>{activeRoute.title}</h1>
            <p className="hero-copy">{activeRoute.description}</p>
          </div>

          <div className="landing-summary-bar" style={{ margin: "20px 0" }}>
            <div className="summary-pill"><span>难度</span><strong>{diffLabel[activeRoute.difficulty]}</strong></div>
            <div className="summary-pill"><span>站点</span><strong>{stops.length} 站</strong></div>
            <div className="summary-pill"><span>XP 奖励</span><strong>+{activeRoute.xp_reward}</strong></div>
            <div className="summary-pill"><span>金币奖励</span><strong>+{activeRoute.coin_reward}</strong></div>
          </div>

          {/* Stop preview */}
          <div style={{ display: "grid", gap: 12, margin: "24px 0" }}>
            {stops.map((stop, i) => (
              <div key={stop.id} className="card" style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 20px" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "#fff",
                  display: "grid", placeItems: "center", fontWeight: 700, fontSize: "1.1rem", flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <strong>{stop.title}</strong>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>{stop.description}</p>
                </div>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  {stop.lat.toFixed(2)}, {stop.lng.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 28 }}>
            {alreadyCompleted ? (
              <div className="notice-card" style={{ textAlign: "center", padding: 24 }}>
                <p style={{ fontSize: "1.5rem" }}>🎉</p>
                <strong>你已经完成了这条路线！</strong>
                <p style={{ color: "var(--muted)" }}>总得分：{progress.total_score} 分</p>
              </div>
            ) : (
              <button className="primary-btn" onClick={handleStart} style={{ fontSize: "1.1rem", padding: "16px 48px" }}>
                开始旅程
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  // ── PLAYING VIEW ──
  if (view === "playing" && currentStop) {
    const stopIndex = progress?.current_stop || 0;
    const totalStops = activeRoute?.stops?.length || 0;
    return (
      <main className="play-shell">
        <GoogleStreetView
          lat={currentStop.lat} lng={currentStop.lng}
          heading={currentStop.heading} pitch={currentStop.pitch} fov={currentStop.fov || 100}
          apiKey={googleMapsApiKey}
        />
        <div className="streetview-vignette" />

        <div className="hud-top">
          <div className="hud-chip hud-chip-user">
            <span>环球之旅</span>
            <strong>{activeRoute?.title}</strong>
          </div>
          <div className="hud-chip">
            <span>站点</span>
            <strong>{stopIndex + 1} / {totalStops}</strong>
          </div>
          <div className="hud-chip">
            <span>当前站</span>
            <strong>{currentStop.title}</strong>
          </div>
          <div className="hud-chip hud-chip-accent">
            <span>状态</span>
            <strong>{guess ? "已放置标记" : "观察中..."}</strong>
          </div>
        </div>

        <div className="hud-actions">
          <button className="secondary-btn" onClick={handleBackToList}>退出路线</button>
        </div>

        <div className="hud-bottom">
          <section className={`mini-map-dock ${mapExpanded ? "expanded" : "collapsed"}`}>
            <button className="dock-toggle" type="button" onClick={() => setMapExpanded(v => !v)}>
              <span>{mapExpanded ? "收起地图" : "展开地图"}</span>
              <strong>{mapExpanded ? "−" : "+"}</strong>
            </button>
            {mapExpanded ? (
              <div className="mini-map-wrap">
                <AmapGuessMap value={guess} onChange={setGuess} apiKey={amapApiKey} />
              </div>
            ) : null}
          </section>
          <section className="card floating-controls">
            <div className="eyebrow">{currentStop.title}</div>
            {currentStop.description ? <p className="floating-title">{currentStop.description}</p> : null}
            <p>当前猜测：<strong>{guess ? ` ${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}` : " 尚未选择"}</strong></p>
            <button className="primary-btn" onClick={handleSubmit} disabled={!guess || status === "submitting"}>
              {status === "submitting" ? "提交中..." : "提交答案"}
            </button>
            {error ? <p className="error-text">{error}</p> : null}
          </section>
        </div>

        {/* Result overlay */}
        {view === "result" && lastResult ? (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300,
            display: "grid", placeItems: "center", padding: 32,
          }}>
            <div className="card" style={{ maxWidth: 700, width: "100%", padding: 32, maxHeight: "90vh", overflow: "auto" }}>
              <h2 style={{ margin: "0 0 4px 0" }}>{lastResult.isComplete ? "🎉 路线完成！" : `📍 第 ${stopIndex + 1} 站结果`}</h2>

              <AmapResultMap result={lastResult} apiKey={amapApiKey} />

              <div className="landing-summary-bar" style={{ margin: "16px 0" }}>
                <div className="summary-pill"><span>距离</span><strong>{lastResult.distanceKm} km</strong></div>
                <div className="summary-pill"><span>得分</span><strong>{lastResult.score}</strong></div>
                <div className="summary-pill"><span>累计</span><strong>{lastResult.totalScore}</strong></div>
              </div>

              {/* Cultural note */}
              {lastResult.culturalNote ? (
                <div className="notice-card" style={{ padding: 16, marginTop: 12, background: "rgba(36,76,71,0.06)" }}>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--green)" }}>📖 文化笔记</p>
                  <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>{lastResult.culturalNote}</p>
                </div>
              ) : null}

              <div style={{ textAlign: "center", marginTop: 20 }}>
                {lastResult.isComplete ? (
                  <button className="primary-btn" onClick={handleBackToList} style={{ fontSize: "1.05rem" }}>
                    返回路线列表
                  </button>
                ) : (
                  <button className="primary-btn" onClick={handleNextStop}>
                    下一站 →
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  // ── COMPLETE VIEW ──
  if (view === "complete" && activeRoute) {
    return (
      <main className="landing-shell">
        <section className="landing-panel" style={{ maxWidth: 700, textAlign: "center" }}>
          <p style={{ fontSize: "3rem", margin: 0 }}>🎉</p>
          <p className="hero-kicker">旅程完成！</p>
          <h1 style={{ fontSize: "2rem", margin: "0 0 8px 0" }}>{activeRoute.title}</h1>
          <p className="hero-copy">{activeRoute.subtitle}</p>

          <div className="landing-summary-bar" style={{ justifyContent: "center", margin: "24px 0" }}>
            <div className="summary-pill"><span>总得分</span><strong>{progress?.total_score || lastResult?.totalScore || 0}</strong></div>
            <div className="summary-pill"><span>XP 奖励</span><strong>+{activeRoute.xp_reward}</strong></div>
            <div className="summary-pill"><span>金币</span><strong>+{activeRoute.coin_reward}</strong></div>
          </div>

          {/* Passport stamps */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", margin: "24px 0" }}>
            {(activeRoute.stops || []).map((stop, i) => (
              <div key={i} style={{
                width: 90, height: 90, border: "2px dashed var(--accent)", borderRadius: 12,
                display: "grid", placeItems: "center", textAlign: "center", padding: 8, fontSize: "0.75rem",
                background: "rgba(180,77,40,0.06)",
              }}>
                <span style={{ fontSize: "1.2rem" }}>🛂</span>
                <span>{stop.title.split("·")[0].trim()}</span>
              </div>
            ))}
          </div>

          <button className="primary-btn" onClick={handleBackToList} style={{ fontSize: "1.05rem" }}>
            探索更多路线
          </button>
        </section>
      </main>
    );
  }

  return null;
}
