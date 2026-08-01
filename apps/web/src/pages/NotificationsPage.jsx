import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

export default function NotificationsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setItems(d.items); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [token]);

  async function markAll() {
    await fetch(`${API_BASE}/notifications/mark-read`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: "all" })
    });
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
  }

  if (status === "loading") return <div className="status-shell">加载通知...</div>;

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Notifications</p>
          <h1>通知中心</h1>
        </div>
        <button className="secondary-btn" onClick={markAll}>全部已读</button>
      </section>

      {!items.length ? (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>🔔</span>
          <strong>暂无通知</strong>
          <p className="hero-copy">当有人回答你的悬赏或审核你的报名时，通知会显示在这里。</p>
        </div>
      ) : (
        <div className="notif-list">
          {items.map(n => (
            <div key={n.id} className={`notif-item ${!n.isRead ? "unread" : ""}`}
              onClick={() => { if (n.link) navigate(n.link); }}>
              <div className="notif-body">
                <strong>{n.title}</strong>
                {n.body ? <p>{n.body}</p> : null}
                <span>{new Date(n.createdAt).toLocaleString("zh-CN")}</span>
              </div>
              {!n.isRead ? <span className="notif-dot" /> : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
