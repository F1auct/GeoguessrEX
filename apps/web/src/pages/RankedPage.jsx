import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

const TIER_EMOJIS = {
  bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎",
  diamond: "💠", master: "👑", grandmaster: "🏆",
};

const TIER_LABELS = {
  bronze: "青铜", silver: "白银", gold: "黄金", platinum: "铂金",
  diamond: "钻石", master: "大师", grandmaster: "王者",
};

const TIER_COLORS = {
  bronze: "#8B6914", silver: "#8C92AC", gold: "#D4A017", platinum: "#4A90A4",
  diamond: "#7B68EE", master: "#FF6B6B", grandmaster: "#FFD700",
};

export default function RankedPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [myRank, setMyRank] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [inQueue, setInQueue] = useState(false);
  const [queueWait, setQueueWait] = useState(0);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview"); // overview | leaderboard | history

  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    try {
      const [meRes, lbRes, histRes] = await Promise.all([
        fetch(`${API_BASE}/ranked/me`, { headers: authHeaders }),
        fetch(`${API_BASE}/ranked/leaderboard`),
        fetch(`${API_BASE}/ranked/history`, { headers: authHeaders }),
      ]);
      if (meRes.ok) setMyRank(await meRes.json());
      if (lbRes.ok) { const d = await lbRes.json(); setLeaderboard(d.items || []); }
      if (histRes.ok) { const d = await histRes.json(); setHistory(d.items || []); }
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Matchmaking polling
  useEffect(() => {
    if (!inQueue) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/ranked/queue/status`, { headers: authHeaders });
        const data = await res.json();
        if (cancelled) return;
        setQueueWait(data.waitedMs || 0);
        if (data.match) {
          // Match found! Create room (bot 对战传入 botId)
          setInQueue(false);
          const roomRes = await fetch(`${API_BASE}/ranked/create-room`, {
            method: "POST", headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ maxRounds: 5, botId: data.match.bot ? data.match.opponentId : null }),
          });
          const roomData = await roomRes.json();
          const roomCode = roomData?.room?.code;
          if (!roomCode) return;
          if (data.match.bot) {
            navigate(`/pvp?code=${roomCode}&ranked=true&opponentId=${data.match.opponentId}&bot=true`);
          } else {
            navigate(`/pvp?code=${roomCode}&ranked=true&opponentId=${data.match.opponentId}`);
          }
        }
      } catch {}
    }
    poll(); // immediate first poll
    const timer = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [inQueue, token, navigate, authHeaders]);

  async function handleJoinQueue() {
    const res = await fetch(`${API_BASE}/ranked/queue/join`, { method: "POST", headers: authHeaders });
    const data = await res.json();
    if (data.queued) setInQueue(true);
  }

  async function handleLeaveQueue() {
    await fetch(`${API_BASE}/ranked/queue/leave`, { method: "POST", headers: authHeaders });
    setInQueue(false);
  }

  function StarBar({ tier, stars, color }) {
    const maxStars = 5;
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
        {Array.from({ length: maxStars }).map((_, i) => (
          <span key={i} style={{
            fontSize: "1.3rem",
            color: i < stars ? (color || "#D4A017") : "rgba(0,0,0,0.15)",
            transition: "all 200ms ease",
          }}>★</span>
        ))}
      </div>
    );
  }

  if (status === "loading") {
    return <div className="status-shell">加载排位信息...</div>;
  }

  return (
    <main className="landing-shell landing-shell-cinematic">
      <div className="auth-backdrop card page-backdrop" />
      <section className="landing-panel" style={{ maxWidth: 900 }}>
        {/* Header */}
        <div className="landing-copy" style={{ textAlign: "center" }}>
          <p className="hero-kicker">⚔️ 排位赛</p>
          <h1 className="display-title">
            <span>Ranked Match</span>
          </h1>
        </div>

        {/* My Rank Card */}
        {myRank ? (
          <div className="card" style={{ textAlign: "center", padding: 32, margin: "20px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>{TIER_EMOJIS[myRank.rank_tier] || "🎯"}</div>
            <h2 style={{ margin: 0, color: myRank.tierColor, fontSize: "1.8rem" }}>{myRank.tierLabel}</h2>
            <StarBar tier={myRank.rank_tier} stars={myRank.rank_stars} color={myRank.tierColor} />
            <p style={{ color: "var(--muted)", margin: "8px 0 0", fontSize: "0.9rem" }}>
              {myRank.rank_stars}/{5} 星 · 排名积分 {myRank.totalStars}
            </p>
            <div className="landing-summary-bar" style={{ justifyContent: "center", margin: "12px 0" }}>
              <div className="summary-pill"><span>本周胜</span><strong style={{ color: "var(--green)" }}>{myRank.weeklyWins}</strong></div>
              <div className="summary-pill"><span>本周负</span><strong style={{ color: "var(--danger)" }}>{myRank.weeklyLosses}</strong></div>
              <div className="summary-pill"><span>胜率</span><strong>{myRank.weeklyWinRate}%</strong></div>
            </div>

            {/* Queue button */}
            {!inQueue ? (
              <button className="primary-btn" onClick={handleJoinQueue} style={{ fontSize: "1.1rem", padding: "16px 48px", marginTop: 12 }}>
                开始排位
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  width: 48, height: 48, border: "4px solid var(--accent)", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
                }} />
                <p style={{ fontWeight: 600 }}>匹配中... {Math.floor(queueWait / 1000)}s</p>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {Math.floor(queueWait / 1000) >= 10 ? "暂时没有真人，将为你匹配人机对手..." : "正在寻找同段位对手"}
                </p>
                <button className="secondary-btn" onClick={handleLeaveQueue} style={{ marginTop: 8 }}>取消匹配</button>
              </div>
            )}
          </div>
        ) : null}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, margin: "20px 0" }}>
          {["overview", "leaderboard", "history"].map(t => (
            <button key={t} className={tab === t ? "primary-btn" : "secondary-btn"} onClick={() => setTab(t)} style={{ flex: 1 }}>
              {{ overview: "总览", leaderboard: "排行榜", history: "战绩" }[t]}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {tab === "leaderboard" ? (
          <div className="card" style={{ padding: 16 }}>
            {leaderboard.map((p, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: "1px solid var(--line)", background: p.id === user?.id ? "rgba(180,77,40,0.06)" : "transparent",
                borderRadius: 8, paddingLeft: 8,
              }}>
                <span style={{ fontWeight: 700, width: 30, textAlign: "center", color: i < 3 ? TIER_COLORS.gold : "var(--muted)", fontSize: i < 3 ? "1.2rem" : "1rem" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span style={{ fontSize: "1.3rem" }}>{TIER_EMOJIS[p.rank_tier]}</span>
                <div style={{ flex: 1 }}>
                  <strong>{p.username}</strong>
                  <span style={{ color: p.tierColor, marginLeft: 8, fontSize: "0.85rem" }}>{p.tierLabel}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{p.rank_stars} ★</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* History */}
        {tab === "history" ? (
          <div className="card" style={{ padding: 16 }}>
            {history.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)" }}>暂无排位记录，开始你的第一局！</p>
            ) : (
              history.map(m => {
                const iWon = m.winner_id === user?.id;
                return (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                    borderBottom: "1px solid var(--line)", opacity: iWon ? 1 : 0.7,
                  }}>
                    <span style={{ fontSize: "1.3rem" }}>{iWon ? "✅" : "❌"}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{iWon ? "胜利" : "失败"}</strong>
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem", marginLeft: 8 }}>
                        {iWon ? `对手: ${m.loser_name}` : `对手: ${m.winner_name}`}
                      </span>
                    </div>
                    <span style={{ color: iWon ? "var(--green)" : "var(--danger)", fontWeight: 600, fontSize: "0.9rem" }}>
                      {iWon ? `+${m.winner_stars_change} ★` : `${m.loser_stars_change} ★`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {/* Overview */}
        {tab === "overview" ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 16px 0" }}>段位说明</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12 }}>
              {Object.entries(TIER_LABELS).map(([key, label], i) => (
                <div key={key} style={{
                  padding: 12, borderRadius: 12, textAlign: "center",
                  background: i === (myRank?.tierIndex || 0) ? `rgba(180,77,40,0.1)` : "rgba(0,0,0,0.02)",
                  border: i === (myRank?.tierIndex || 0) ? `2px solid ${myRank?.tierColor || "#666"}` : "1px solid var(--line)",
                }}>
                  <div style={{ fontSize: "1.5rem" }}>{TIER_EMOJIS[key]}</div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: TIER_COLORS[key] }}>{label}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{i * 5} 分</div>
                </div>
              ))}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 16 }}>
              每局胜利 +1 ★ · 满 5 ★ 晋级 · 失败 -1 ★ · 青铜不掉星
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
