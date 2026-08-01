import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import GoogleStreetView from "../components/GoogleStreetView.jsx";
import AmapGuessMap from "../components/AmapGuessMap.jsx";

const API_BASE = "http://localhost:3001/api";

export default function DailyChallengePage() {
  const { token, user } = useAuth();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const amapApiKey = import.meta.env.VITE_AMAP_API_KEY || "";

  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [guess, setGuess] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState({ level: 1, xp: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/daily-challenge`).then(r => r.json()),
      token ? fetch(`${API_BASE}/daily-challenge/my`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null) : null,
      fetch(`${API_BASE}/daily-challenge/leaderboard`).then(r => r.json())
    ]).then(([data, my, lb]) => {
      setQuestions(data.questions || []);
      if (my) {
        const map = {};
        (my.submissions || []).forEach(s => { map[s.challengeId] = s; });
        setSubmissions(map);
        setStreak(my.streak);
        setLevel(my.level);
      }
      setLeaderboard(lb.items || []);
      setStatus("ready");
    }).catch(e => { setError(e.message); setStatus("error"); });
  }, [token]);

  const question = questions[qIndex] || null;
  const totalDone = Object.keys(submissions).length;

  async function handleSubmit() {
    if (!question || !guess) return;
    setSubmitting(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/daily-challenge/submit`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ challengeId: question.id, guess })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
      setSubmissions(prev => ({ ...prev, [question.id]: data.submission }));
      // Refresh leaderboard
      fetch(`${API_BASE}/daily-challenge/leaderboard`).then(r => r.json()).then(d => setLeaderboard(d.items || []));
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function handleNext() {
    if (qIndex + 1 >= questions.length) { setQIndex(0); }
    else { setQIndex(qIndex + 1); }
    setGuess(null); setResult(null); setMapExpanded(true);
  }

  if (status === "loading") return <div className="status-shell">加载每日挑战...</div>;
  if (status === "error") return <div className="status-shell"><p>加载失败：{error}</p></div>;
  if (!questions.length) return <div className="status-shell"><p>今日暂无挑战题</p></div>;

  // 全部答完
  if (totalDone >= questions.length) {
    const totalScore = Object.values(submissions).reduce((s, sub) => s + (sub.score || 0), 0);
    return (
      <main className="page-shell">
        <section className="page-header card">
          <div>
            <p className="hero-kicker">Daily Challenge</p>
            <h1>🎉 今日挑战完成！</h1>
            <p className="hero-copy">总得分：<strong>{totalScore}</strong> 分 · 签到 {streak} 天 🔥</p>
          </div>
        </section>
        <div className="detail-info-strip">
          <div className="detail-info-item"><span>等级</span><strong>Lv.{level.level}</strong></div>
          <div className="detail-info-item"><span>签到</span><strong>🔥 {streak} 天</strong></div>
          <div className="detail-info-item"><span>完成</span><strong>{totalDone}/{questions.length}</strong></div>
          <div className="detail-info-item"><span>总分</span><strong>{totalScore} 分</strong></div>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(19,26,30,0.06)" }}><h3 style={{ margin: 0 }}>🏆 今日排行</h3></div>
          <div className="lb-list" style={{ padding: 16 }}>
            {leaderboard.map((item, i) => (
              <div key={item.userId} className={`lb-item ${i < 3 ? "lb-top3" : ""}`}>
                <div className="lb-rank">{i < 3 ? <span className="lb-medal">{["🥇","🥈","🥉"][i]}</span> : <span className="lb-rank-num">{i + 1}</span>}</div>
                <div className="lb-user"><span className="lb-avatar">{item.username?.[0]?.toUpperCase()}</span><strong>{item.username}</strong></div>
                <div className="lb-value">{item.score} 分</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="play-shell daily-play-shell">
      <GoogleStreetView lat={question.lat} lng={question.lng} heading={question.heading || 0} pitch={question.pitch || 0} fov={question.fov || 90} apiKey={googleMapsApiKey} />
      <div className="streetview-vignette" />

      {/* 顶部 HUD */}
      <div className="hud-top">
        <div className="hud-chip"><span>每日挑战</span><strong>{qIndex + 1}/{questions.length}</strong></div>
        <div className="hud-chip"><span>{question.country || "世界"}</span><strong>{question.title}</strong></div>
        <div className="hud-chip"><span>签到</span><strong>🔥 {streak} 天</strong></div>
        <div className="hud-chip"><span>Lv.{level.level}</span><strong>{level.xp} XP</strong></div>
      </div>

      {/* 底部操作区 */}
      <div className="daily-bottom-bar">
        {/* 地图 */}
        <div className={`daily-map-area ${mapExpanded ? "expanded" : "collapsed"}`}>
          <button className="daily-map-toggle" onClick={() => setMapExpanded(c => !c)}>
            {mapExpanded ? "收起地图 ▲" : "打开地图 ▼"}
          </button>
          {mapExpanded ? <AmapGuessMap value={guess} onChange={setGuess} apiKey={amapApiKey} /> : null}
        </div>

        {/* 操作面板 */}
        <div className="daily-control-panel">
          {!result ? (
            <>
              <div className="daily-guess-info">
                <span className="daily-guess-label">你的猜测</span>
                <span className="daily-guess-coords">{guess ? `${guess.lat.toFixed(4)}, ${guess.lng.toFixed(4)}` : "在地图上点击选点"}</span>
              </div>
              <button className="daily-submit-btn" onClick={handleSubmit} disabled={!guess || submitting}>
                {submitting ? "提交中..." : "🚀 确认提交"}
              </button>
            </>
          ) : (
            <>
              <div className="daily-result-row">
                <div className="daily-result-item">
                  <span className="daily-result-num">{result.submission.distanceKm.toFixed(2)}</span>
                  <span className="daily-result-unit">km</span>
                </div>
                <div className="daily-result-divider" />
                <div className="daily-result-item">
                  <span className={`daily-result-num ${result.submission.score >= 4000 ? "good" : ""}`}>{result.submission.score}</span>
                  <span className="daily-result-unit">分</span>
                </div>
                {result.submission.won ? <span className="daily-won-badge">🌟 精准!</span> : null}
              </div>
              <button className="daily-submit-btn daily-next-btn" onClick={handleNext}>
                {qIndex + 1 >= questions.length ? "🏆 查看排行榜" : "下一题 →"}
              </button>
            </>
          )}
          {error ? <p className="daily-error">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
