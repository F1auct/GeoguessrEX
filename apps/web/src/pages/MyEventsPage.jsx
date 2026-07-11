import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

async function fetchMyGames(token) {
  const res = await fetch(`${API_BASE}/games/my`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("获取活动列表失败");
  return res.json();
}

async function approveReg(gameId, regId, action, token) {
  const res = await fetch(`${API_BASE}/games/${gameId}/registrations/${regId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "操作失败");
  }
  return res.json();
}

export default function MyEventsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  function load() {
    setStatus("loading");
    fetchMyGames(token)
      .then((data) => { setGames(data.items); setStatus("ready"); })
      .catch((err) => { setError(err.message); setStatus("error"); });
  }

  useEffect(() => { load(); }, [token]);

  async function handleApprove(gameId, regId, action) {
    try {
      await approveReg(gameId, regId, action, token);
      setActionMsg(`已${action === "approved" ? "通过" : "拒绝"}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === "loading") return <div className="status-shell">加载活动列表...</div>;
  if (status === "error") return <div className="status-shell"><p>加载失败：{error}</p><button className="secondary-btn" onClick={load}>重试</button></div>;

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">My Events</p>
          <h1>我举办的活动</h1>
          <p className="hero-copy">管理你创建的游戏，审核需要身份信息的报名。</p>
        </div>
        <button className="secondary-btn" onClick={() => navigate("/games")}>返回游戏列表</button>
      </section>

      {actionMsg ? <div className="detail-toast">{actionMsg}</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!games.length ? (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>📭</span>
          <strong>你还没有创建任何活动</strong>
          <p className="hero-copy">去创建你的第一个藏宝或推理游戏吧！</p>
          <button className="primary-btn" onClick={() => navigate("/games/create")}>创建活动</button>
        </div>
      ) : (
        <div className="my-events-list">
          {games.map((game) => {
            const pendingRegs = (game.registrations || []).filter((r) => r.status === "pending");
            const approvedRegs = (game.registrations || []).filter((r) => r.status === "approved");
            return (
              <div key={game.id} className="card my-event-card">
                <div className="my-event-head">
                  <div>
                    <span className="badge badge-type">{game.gameType === "treasure_hunt" ? "🗺️ 藏宝" : "🧩 推理"}</span>
                    <span className={`badge badge-${game.status}`}>{game.status === "pending_review" ? "审核中" : game.status === "approved" ? "已批准" : game.status === "active" ? "进行中" : game.status === "completed" ? "已完成" : game.status === "revoked" ? "已撤销" : game.status}</span>
                    <h3>{game.title}</h3>
                  </div>
                  <button className="secondary-btn" onClick={() => navigate(`/games/${game.id}`)}>查看详情</button>
                </div>

                <div className="my-event-stats">
                  <div className="my-event-stat">
                    <strong>{game.locationTasks?.length || 0}</strong><span>地点</span>
                  </div>
                  <div className="my-event-stat">
                    <strong>{approvedRegs.length}</strong><span>已通过</span>
                  </div>
                  <div className="my-event-stat">
                    <strong>{pendingRegs.length}</strong><span>待审核</span>
                  </div>
                  <div className="my-event-stat">
                    <strong>{game.requirePlayerInfo ? "是" : "否"}</strong><span>需身份信息</span>
                  </div>
                </div>

                {/* 待审核报名（仅需身份信息时） */}
                {game.requirePlayerInfo && pendingRegs.length > 0 ? (
                  <div className="my-event-pending">
                    <div className="my-event-pending-head">
                      <span className="eyebrow">待审核报名</span>
                      <span className="admin-count">{pendingRegs.length}</span>
                    </div>
                    {pendingRegs.map((reg) => (
                      <div key={reg.id} className="my-event-reg-item">
                        <div className="my-event-reg-info">
                          <strong>{reg.username}</strong>
                          <span>{reg.email}</span>
                          {reg.playerInfo && Object.keys(reg.playerInfo).length > 0 ? (
                            <p>{Object.entries(reg.playerInfo).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                          ) : null}
                        </div>
                        <div className="my-event-reg-actions">
                          <button className="primary-btn" onClick={() => handleApprove(game.id, reg.id, "approved")}>通过</button>
                          <button className="secondary-btn danger-btn" onClick={() => handleApprove(game.id, reg.id, "rejected")}>拒绝</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* 已通过的参与者 */}
                {approvedRegs.length > 0 ? (
                  <div className="my-event-approved">
                    <span className="eyebrow">已通过参与者 ({approvedRegs.length})</span>
                    <div className="my-event-approved-list">
                      {approvedRegs.map((reg) => (
                        <span key={reg.id} className="my-event-player-tag">{reg.username}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
