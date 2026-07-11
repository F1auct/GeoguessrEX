import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API = "http://localhost:3001/api";

export default function SeasonPage() {
  const { token, user } = useAuth();
  const [season, setSeason] = useState(null);
  const [pass, setPass] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/season`).then(r => r.json()),
      token ? fetch(`${API}/season/pass`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null) : null,
      fetch(`${API}/season/leaderboard`).then(r => r.json())
    ]).then(([s, p, lb]) => {
      setSeason(s); setPass(p); setLeaderboard(lb.items || []); setStatus("ready");
    }).catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") return <div className="status-shell">加载赛季...</div>;
  if (!season) return <div className="status-shell">暂无赛季数据</div>;

  const maxLevel = season.levels?.length || 20;
  const userLevel = pass?.level || 1;
  const userXp = pass?.xp || 0;
  const progress = pass?.progress || 0;
  const endDate = new Date(season.endDate);
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000));

  return (
    <main className="page-shell">
      {/* Hero */}
      <section className="season-hero">
        <div className="season-hero-bg" />
        <div className="season-hero-content">
          <div className="season-hero-left">
            <span className="season-badge">🏆 赛季通行证</span>
            <h1>{season.name}</h1>
            <p>{season.theme} · 剩余 <strong>{daysLeft}</strong> 天</p>
            <p className="season-dates">{new Date(season.startDate).toLocaleDateString("zh-CN")} — {new Date(season.endDate).toLocaleDateString("zh-CN")}</p>
          </div>
          <div className="season-hero-right">
            <div className="season-level-ring">
              <svg viewBox="0 0 120 120" width="120" height="120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(214,184,143,0.15)" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="url(#seasonGrad)" strokeWidth="10"
                  strokeDasharray={`${(progress / 100) * 326.7} 326.7`}
                  strokeLinecap="round" transform="rotate(-90 60 60)" />
                <defs><linearGradient id="seasonGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#d97706" /></linearGradient></defs>
              </svg>
              <div className="season-level-center">
                <span className="season-level-num">{userLevel}</span>
                <span className="season-level-label">等级</span>
              </div>
            </div>
          </div>
        </div>
        <div className="season-progress-bar">
          <div className="season-progress-fill" style={{ width: `${progress}%` }} />
          <span className="season-progress-text">{userXp.toLocaleString()} / {pass?.nextLevelXp?.toLocaleString() || "MAX"} XP</span>
        </div>
      </section>

      {/* 奖励路线 */}
      <section className="season-rewards">
        <h3>🎁 赛季奖励</h3>
        <div className="season-rewards-scroll">
          {(season.levels || []).map((lvl, i) => {
            const unlocked = pass ? (userLevel > lvl.level || (userLevel === lvl.level && progress >= 100)) : false;
            const current = pass && lvl.level === userLevel;
            return (
              <div key={lvl.level} className={`season-reward-card ${unlocked ? "unlocked" : ""} ${current ? "current" : ""}`}>
                <div className="season-reward-level">{lvl.level}</div>
                <div className="season-reward-icon">{unlocked ? "✅" : current ? "🔓" : "🔒"}</div>
                <div className="season-reward-text">{lvl.reward}</div>
                <div className="season-reward-xp">{lvl.xp.toLocaleString()} XP</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 排行榜 */}
      <section className="card" style={{ padding: 0 }}>
        <div className="team-lb-header"><h3>🏆 赛季排行榜</h3></div>
        {leaderboard.length > 0 ? (
          <div className="team-lb-list">
            {leaderboard.map((item, i) => (
              <div key={item.userId} className={`lb-item team-lb-item ${i < 3 ? "lb-top3" : ""} ${item.userId === user?.id ? "team-lb-mine" : ""}`}>
                <div className="lb-rank">{i < 3 ? <span className="lb-medal">{["🥇","🥈","🥉"][i]}</span> : <span className="lb-rank-num">{item.rank}</span>}</div>
                <div className="lb-user"><strong>{item.username}</strong><span className="lb-meta">Lv.{item.level}</span></div>
                <div className="lb-value">{item.xp.toLocaleString()} XP</div>
              </div>
            ))}
          </div>
        ) : <p className="team-lb-empty">暂无排行</p>}
      </section>

      {/* 如何获得赛季经验 */}
      <div className="detail-info-strip">
        <div className="detail-info-item"><span>⚔️ PvP 获胜</span><strong>+100 XP</strong></div>
        <div className="detail-info-item"><span>🔥 大逃杀获胜</span><strong>+200 XP</strong></div>
        <div className="detail-info-item"><span>📅 每日挑战</span><strong>+30 XP</strong></div>
        <div className="detail-info-item"><span>💰 悬赏答题</span><strong>+15~80 XP</strong></div>
        <div className="detail-info-item"><span>🗺️ 藏宝通关</span><strong>+25~120 XP</strong></div>
      </div>
    </main>
  );
}
