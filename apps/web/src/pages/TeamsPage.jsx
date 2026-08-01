import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";
const MEDALS = ["🥇", "🥈", "🥉"];

export default function TeamsPage() {
  const { token, user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rankType, setRankType] = useState("xp");
  const [memberStats, setMemberStats] = useState([]);
  const [status, setStatus] = useState("loading");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);

  function load() {
    setStatus("loading");
    const p = [
      fetch(`${API_BASE}/teams`).then(r => r.json()),
      fetch(`${API_BASE}/teams/leaderboard?type=${rankType}`).then(r => r.json()),
      token ? fetch(`${API_BASE}/teams/my`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null) : null
    ];
    Promise.all(p).then(async ([t, lb, my]) => {
      setTeams(t.items || []);
      setLeaderboard(lb.items || []);
      const team = my && my.id ? my : null;
      setMyTeam(team);
      if (team) {
        try {
          const r = await fetch(`${API_BASE}/teams/${team.id}/stats`);
          const d = await r.json();
          setMemberStats(d.members || []);
        } catch { setMemberStats([]); }
      }
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }

  useEffect(() => { load(); }, [token, rankType]);

  function reload() { load(); }

  async function create() {
    try {
      const r = await fetch(`${API_BASE}/teams`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setShowCreate(false); setMsg("团队创建成功！"); reload();
    } catch (e) { setMsg(e.message); }
  }
  async function join(teamId) {
    try {
      const r = await fetch(`${API_BASE}/teams/${teamId}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setMsg("加入成功！"); reload();
    } catch (e) { setMsg(e.message); }
  }
  async function leave(teamId) {
    if (!window.confirm("确定退出团队？")) return;
    try {
      await fetch(`${API_BASE}/teams/${teamId}/leave`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setMyTeam(null); setMsg("已退出。"); reload();
    } catch (e) { setMsg(e.message); }
  }
  async function toggleExpand(teamId) {
    if (expandedId === teamId) { setExpandedId(null); setExpandedData(null); return; }
    setExpandedId(teamId);
    const r = await fetch(`${API_BASE}/teams/${teamId}`);
    setExpandedData(await r.json());
  }

  if (status === "loading") return <div className="status-shell">加载团队...</div>;

  const rankInfo = (() => { const idx = leaderboard.findIndex(t => t.id === myTeam?.id); return idx >= 0 ? `🏆 第${idx + 1}名` : "未上榜"; })();

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div><p className="hero-kicker">Teams</p><h1>团队 / 公会</h1><p className="hero-copy">组队闯关、争霸排行！所有数据每日实时计算。</p></div>
        {!myTeam ? <button className="primary-btn" onClick={() => setShowCreate(true)}>+ 创建团队</button> : null}
      </section>
      {msg ? <div className="detail-toast" onClick={() => setMsg("")}>{msg}</div> : null}

      {myTeam ? (
        /* ====== 已加入：Grid 双栏严格对齐 ====== */
        <div className="team-grid-layout">
          <div className="team-grid-left">
            <TeamInfoCard myTeam={myTeam} leaderboard={leaderboard} rankType={rankType} rankInfo={rankInfo} isOwner={myTeam.ownerId === user?.id} onLeave={() => leave(myTeam.id)} />
            <ChartCard title="📊 经验值" data={memberStats} field="xp" suffix=" XP" color="accent" />
            <ChartCard title="🏹 悬赏获胜" data={memberStats} field="bountyWins" suffix=" 次" color="green" />
            <ChartCard title="🗺️ 藏宝通关" data={memberStats} field="huntCompletions" suffix=" 次" color="accent" />
          </div>
          <div className="team-grid-right">
            <TeamLeaderboard leaderboard={leaderboard} rankType={rankType} setRankType={setRankType} myTeamId={myTeam.id} />
            <ChartCard title="🎯 最佳单次得分" data={memberStats} field="bestScore" suffix=" 分" color="green" />
            <ChartCard title="📝 社区贡献" data={memberStats} field="posts" suffix=" 篇" color="accent" />
            <ChartCard title="📅 每日挑战积分" data={memberStats} field="dailyScore" suffix=" 分" color="green" />
          </div>
        </div>
      ) : (
        /* ====== 未加入：单列 ====== */
        <>
          {showCreate ? (
            <div className="card team-create-card">
              <h3>创建新团队</h3>
              <label><span>团队名称</span><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="起个响亮的名字" /></label>
              <label><span>简介</span><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="团队口号" /></label>
              <div className="form-actions"><button className="primary-btn" onClick={create}>确认创建</button><button className="secondary-btn" onClick={() => setShowCreate(false)}>取消</button></div>
            </div>
          ) : null}
          <TeamLeaderboard leaderboard={leaderboard} rankType={rankType} setRankType={setRankType} myTeamId={null} />
          <TeamList teams={teams} myTeam={myTeam} expandedId={expandedId} expandedData={expandedData} onJoin={join} onToggle={toggleExpand} />
        </>
      )}
    </main>
  );
}

/* ── 子组件 ── */

function TeamInfoCard({ myTeam, leaderboard, rankType, rankInfo, isOwner, onLeave }) {
  return (
    <div className="card team-my-card">
      <div className="team-my-header">
        <span className="team-my-icon">🌟</span>
        <div><h2>{myTeam.name}</h2><p>{myTeam.description || "暂无简介"}</p></div>
        <div className="team-my-badge">{rankInfo}</div>
      </div>
      <div className="team-my-stats">
        <div><span>{myTeam.members?.length || 0}</span>成员</div>
        <div><span>{leaderboard.find(t => t.id === myTeam.id)?.value?.toLocaleString() || 0}</span>{rankType === "xp" ? "XP" : "分"}</div>
        <div><span>{myTeam.ownerName}</span>队长</div>
      </div>
      <div className="team-my-actions">
        {!isOwner ? <button className="secondary-btn danger-btn" onClick={onLeave}>退出团队</button> : <span className="form-help">👑 你是队长</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, data, field, suffix, color }) {
  const maxVal = Math.max(1, ...data.map(d => d[field] || 0));
  const barClass = color === "green" ? "team-bar-fill-green" : "team-bar-fill";
  return (
    <div className="card team-chart-card">
      <h3>{title}</h3>
      {data.length > 0 ? (
        <div className="team-bar-chart">
          {data.map(m => {
            const val = m[field] || 0;
            const pct = Math.round((val / maxVal) * 10) * 10;
            return (
              <div key={m.userId} className="team-bar-row">
                <span className="team-bar-name">{m.username}</span>
                <div className="team-bar-track">
                  <div className={barClass} style={{ width: `${Math.max(pct, 5)}%` }}>
                    <span>{val.toLocaleString()}{suffix}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="team-lb-empty">暂无数据</p>}
    </div>
  );
}

function TeamLeaderboard({ leaderboard, rankType, setRankType, myTeamId }) {
  return (
    <div className="card" style={{ padding: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="team-lb-header">
        <h3>🏆 团队排行榜</h3>
        <select value={rankType} onChange={e => setRankType(e.target.value)} className="team-rank-select">
          <option value="xp">总经验</option><option value="total_score">总积分</option><option value="daily_score">日积分</option>
          <option value="weekly_score">周积分</option><option value="monthly_score">月积分</option><option value="daily_challenge_score">每日挑战积分</option>
        </select>
      </div>
      <div className="team-lb-list" style={{ flex: 1 }}>
        {leaderboard.length > 0 ? leaderboard.map((item, i) => (
          <div key={item.id} className={`lb-item team-lb-item ${i < 3 ? "lb-top3" : ""} ${myTeamId && item.id === myTeamId ? "team-lb-mine" : ""}`}>
            <div className="lb-rank">{i < 3 ? <span className="lb-medal">{MEDALS[i]}</span> : <span className="lb-rank-num">{item.rank}</span>}</div>
            <div className="lb-user"><strong>{item.name}</strong><span className="lb-meta">{item.memberCount}人 · {item.ownerName}</span></div>
            <div className="lb-value">{rankType === "xp" ? `${(item.value || 0).toLocaleString()} XP` : `${(item.value || 0).toLocaleString()} 分`}</div>
          </div>
        )) : <p className="team-lb-empty">暂无排行数据</p>}
      </div>
    </div>
  );
}

function TeamList({ teams, myTeam, expandedId, expandedData, onJoin, onToggle }) {
  return (
    <>
      <h3 style={{ marginTop: 24 }}>👥 全部团队</h3>
      <div className="team-list-grid">
        {teams.map(t => {
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className={`card team-list-card ${isExpanded ? "expanded" : ""}`}>
              <div className="team-list-head"><span className="badge badge-type">👥 {t.memberCount}人</span><strong>{t.name}</strong></div>
              <p className="card-desc">{t.description || "暂无简介"}</p>
              <div className="team-list-actions">
                {!myTeam ? <button className="primary-btn team-join-btn" onClick={() => onJoin(t.id)}>加入</button> : null}
                <button className="secondary-btn team-expand-btn" onClick={() => onToggle(t.id)}>{isExpanded ? "收起 ▲" : "成员 ▼"}</button>
              </div>
              {isExpanded && expandedData ? (
                <div className="team-expand-panel">
                  {expandedData.members?.map(m => (
                    <div key={m.id} className="team-expand-member">
                      <span className="team-member-avatar" style={{ background: m.role === "owner" ? "var(--accent-dark)" : "var(--green)" }}>{m.username?.[0]?.toUpperCase()}</span>
                      <strong>{m.username}</strong><span className="form-help">Lv.{m.level}</span>{m.role === "owner" ? "👑" : ""}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
