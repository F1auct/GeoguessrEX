import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GoogleStreetView from "../components/GoogleStreetView.jsx";
import AmapGuessMap from "../components/AmapGuessMap.jsx";
import AmapResultMap from "../components/AmapResultMap.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

export default function CountryStreakPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const amapApiKey = import.meta.env.VITE_AMAP_API_KEY || "";

  const [question, setQuestion] = useState(null);
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [mapExpanded, setMapExpanded] = useState(true);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [showLB, setShowLB] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  async function loadQuestion() {
    setStatus("loading");
    setGuess(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/streak/question`, { headers: authHeaders });
      const data = await res.json();
      if (data.error) { setError(data.error); setStatus("error"); return; }
      setQuestion(data);
      setStreak(data.streak || 0);
      setBestStreak(data.bestStreak || 0);
      setStatus("ready");
    } catch (err) {
      setError("加载题目失败");
      setStatus("error");
    }
  }

  async function handleSubmit() {
    if (!question || !guess) return;
    setStatus("submitting");
    try {
      const res = await fetch(`${API_BASE}/streak/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ questionId: question.id, guess }),
      });
      const data = await res.json();
      setResult(data);
      setStreak(data.streak || 0);
      setBestStreak(data.bestStreak || 0);
      setStatus("result");
    } catch (err) {
      setError("提交失败");
      setStatus("ready");
    }
  }

  function handleNext() {
    if (result?.correct) {
      loadQuestion();
    } else {
      // Streak broken — reset
      setResult(null);
      setGuess(null);
      loadQuestion();
    }
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/streak/leaderboard`);
      const data = await res.json();
      setLeaderboard(data.items || []);
      setShowLB(true);
    } catch {}
  }

  useEffect(() => { loadQuestion(); loadLeaderboard(); }, []);

  return (
    <main className="play-shell">
      {!result && question ? (
        <>
          <GoogleStreetView lat={question.lat} lng={question.lng} heading={question.heading || 0} pitch={question.pitch || 0} fov={question.fov || 100} apiKey={googleMapsApiKey} />
          <div className="streetview-vignette" />

          <div className="hud-top">
            <div className="hud-chip hud-chip-accent">
              <span>🔥 连击</span>
              <strong>{streak}</strong>
            </div>
            <div className="hud-chip">
              <span>最佳</span>
              <strong>{bestStreak}</strong>
            </div>
            <div className="hud-chip">
              <span>状态</span>
              <strong>{guess ? "已标记" : "猜国家"}</strong>
            </div>
          </div>

          <div className="hud-actions">
            <button className="secondary-btn" onClick={() => navigate("/")}>返回</button>
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
              <div className="eyebrow">国家连击</div>
              <p>猜对这个国家就能延续你的连击记录！</p>
              <button className="primary-btn" onClick={handleSubmit} disabled={!guess || status === "submitting"}>
                {status === "submitting" ? "提交中..." : "提交答案"}
              </button>
            </section>
          </div>
        </>
      ) : null}

      {/* Result Modal */}
      {result ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "grid", placeItems: "center", padding: 32 }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: "3rem", margin: 0 }}>{result.correct ? "🎉" : "💔"}</p>
            <h2>{result.correct ? "答对了！" : "连击中断"}</h2>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, color: result.correct ? "var(--green)" : "var(--danger)" }}>
              {result.correct ? "继续冲！" : `猜错了，这是 ${result.correctCountry || "未知"}`}
            </p>

            <div className="landing-summary-bar" style={{ justifyContent: "center", margin: "16px 0" }}>
              <div className="summary-pill"><span>当前连击</span><strong>{streak}</strong></div>
              <div className="summary-pill"><span>最佳连击</span><strong>{bestStreak}</strong></div>
            </div>

            {result.correct ? (
              <button className="primary-btn" onClick={handleNext}>下一题 →</button>
            ) : (
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="secondary-btn" onClick={handleNext}>重新开始</button>
                <button className="primary-btn" onClick={() => navigate("/")}>返回首页</button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
