import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

export default function PeakPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [inQueue, setInQueue] = useState(false);
  const [queueWait, setQueueWait] = useState(0);
  const [status, setStatus] = useState("loading");
  const [tab, setTab] = useState("overview");

  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    try {
      const [eligRes, lbRes, histRes] = await Promise.all([
        fetch(`${API_BASE}/peak/eligibility`, { headers: authHeaders }),
        fetch(`${API_BASE}/peak/leaderboard`),
        fetch(`${API_BASE}/peak/history`, { headers: authHeaders }),
      ]);
      if (eligRes.ok) setEligibility(await eligRes.json());
      if (lbRes.ok) { const d = await lbRes.json(); setLeaderboard(d.items || []); }
      if (histRes.ok) { const d = await histRes.json(); setHistory(d.items || []); }
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Matchmaking polling
  useEffect(() => {
    if (!inQueue) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/peak/queue/status`, { headers: authHeaders });
        const data = await res.json();
        if (cancelled) return;
        if (!data.isOpen) { setInQueue(false); return; }
        setQueueWait(data.waitedMs || 0);
        if (data.match) {
          setInQueue(false);
          const roomRes = await fetch(`${API_BASE}/peak/create-room`, {
            method: "POST", headers: { "Content-Type": "application/json", ...authHeaders },
          });
          const room = await roomRes.json();
          navigate(`/pvp?code=${room.code}&peak=true&opponentId=${data.match.opponentId}`);
        }
      } catch {}
    }
    poll();
    const timer = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [inQueue, token, navigate]);

  async function handleJoinQueue() {
    const res = await fetch(`${API_BASE}/peak/queue/join`, { method: "POST", headers: authHeaders });
    const data = await res.json();
    if (data.queued) setInQueue(true);
    else if (data.error) alert(data.error);
  }

  async function handleLeaveQueue() {
    await fetch(`${API_BASE}/peak/queue/leave`, { method: "POST", headers: authHeaders });
    setInQueue(false);
  }

  if (status === "loading") return <div className="status-shell">加载巅峰赛...</div>;

  const isOpen = eligibility?.isOpen;

  return (
    <main className="landing-shell landing-shell-cinematic">
      <div className="auth-backdrop card page-backdrop" />
      <section className="landing-panel" style={{ maxWidth: 900 }}>
        <div className="landing-copy" style={{ textAlign: "center" }}>
          <p className="hero-kicker">🏆 巅峰赛</p>
          <h1 className="display-title"><span>Peak Tournament</span></h1>
        </div>

        {/* Elite Card */}
        <div className="card" style={{ textAlign: "center", padding: 32, margin: "20px 0", border: "2px solid var(--gold, #D4A017)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 4 }}>👑</div>
          <h2 style={{ margin: 0, color: "#D4A017" }}>
            {eligibility?.eligible ? `${eligibility.peakScore} 分` : "未解锁"}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            {eligibility?.eligible
              ? `段位 ${user?.rank_tier || "?"} · 已达标`
              : eligibility?.reason || "段位 ≥ 钻石 + 20 局排位可解锁"}
          </p>

          {/* Open status */}
          <div style={{ margin: "12px 0" }}>
            <span className="badge" style={{
              background: isOpen ? "rgba(36,76,71,0.12)" : "rgba(180,77,40,0.12)",
              color: isOpen ? "var(--green)" : "var(--danger)",
              fontSize: "0.9rem", padding: "6px 16px",
            }}>
              {isOpen ? "🟢 开放中 (18:00-24:00)" : "🔴 已关闭 (每日 18:00-24:00)"}
            </span>
          </div>

          {eligibility?.eligible ? (
            !inQueue ? (
              <button className="primary-btn" onClick={handleJoinQueue}
                disabled={!isOpen}
                style={{ fontSize: "1.1rem", padding: "16px 48px", opacity: isOpen ? 1 : 0.5 }}>
                {isOpen ? "开始巅峰对决" : "当前不在开放时间"}
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  width: 48, height: 48, border: "4px solid #D4A017", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
                }} />
                <p style={{ fontWeight: 600 }}>匹配中... {Math.floor(queueWait / 1000)}s</p>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  盲选模式 · 隐藏对手信息 · 积分±{15}~{25}
                </p>
                <button className="secondary-btn" onClick={handleLeaveQueue}>取消匹配</button>
              </div>
            )
          ) : null}

          <div className="landing-summary-bar" style={{ justifyContent: "center", marginTop: 16 }}>
            <div className="summary-pill"><span>准入门槛</span><strong>钻石段位</strong></div>
            <div className="summary-pill"><span>开放时间</span><strong>18:00-24:00</strong></div>
            <div className="summary-pill"><span>积分制</span><strong>ELO</strong></div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, margin: "20px 0" }}>
          {["overview", "leaderboard", "history"].map(t => (
            <button key={t} className={tab === t ? "primary-btn" : "secondary-btn"} onClick={() => setTab(t)} style={{ flex: 1 }}>
              {{ overview: "规则", leaderboard: "巅峰榜", history: "战绩" }[t]}
            </button>
          ))}
        </div>

        {tab === "leaderboard" ? (
          <div className="card" style={{ padding: 16 }}>
            {leaderboard.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)" }}>暂无数据</p>
            ) : (
              leaderboard.map((p, i) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                  background: p.id === user?.id ? "rgba(212,160,23,0.06)" : "transparent", borderRadius: 8, paddingLeft: 8,
                }}>
                  <span style={{ fontWeight: 700, width: 30, textAlign: "center", color: i < 3 ? "#D4A017" : "var(--muted)", fontSize: i < 3 ? "1.2rem" : "1rem" }}>
                    {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <strong>{p.username}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: 8 }}>{p.rank_tier}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#D4A017" }}>{p.peak_score}</span>
                </div>
              ))
            )}
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="card" style={{ padding: 16 }}>
            {history.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)" }}>暂无巅峰赛记录</p>
            ) : (
              history.map(m => {
                const iWon = m.winner_id === user?.id;
                return (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)",
                  }}>
                    <span>{iWon ? "✅" : "❌"}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{iWon ? "胜利" : "失败"}</strong>
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem", marginLeft: 8 }}>
                        vs {iWon ? m.loser_name : m.winner_name}
                      </span>
                    </div>
                    <span style={{ color: iWon ? "var(--green)" : "var(--danger)", fontWeight: 600 }}>
                      {iWon ? `+${m.winner_score_change}` : `${m.loser_score_change}`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {tab === "overview" ? (
          <div className="card" style={{ padding: 24 }}>
            <h3>巅峰赛规则</h3>
            <ul style={{ lineHeight: 2 }}>
              <li>仅<strong>钻石及以上段位</strong>的玩家可以参加</li>
              <li>每个赛季需完成至少 <strong>20 局排位赛</strong></li>
              <li>每日 <strong>18:00-24:00</strong> 限时开放</li>
              <li><strong>盲选模式</strong>：匹配后隐藏对手昵称，专注实力对决</li>
              <li>采用 <strong>ELO 积分制</strong>（初始 1200 分），胜方+分，败方-分</li>
              <li>对手积分越高，胜利加分越多</li>
              <li>赛季结束后按巅峰积分排名发放<strong>限定奖励</strong></li>
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
