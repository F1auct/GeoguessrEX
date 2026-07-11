import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

function Dropdown({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function click(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div className="nav-dropdown" ref={ref}>
      <button className={`nav-link nav-dropdown-trigger ${open ? "active" : ""}`} onClick={() => setOpen(!open)}>
        {label} <span className="nav-dropdown-arrow">▾</span>
      </button>
      {open ? <div className="nav-dropdown-menu">{children}</div> : null}
    </div>
  );
}

export default function NavBar() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token) return;
    function check() {
      fetch(`${API_BASE}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setUnread(d.count || 0)).catch(() => {});
    }
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [token]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <Link to="/" className="nav-brand">GeoGuessrEX</Link>

        <Dropdown label="⚡ 竞技">
          <Link to="/pvp" className="nav-dropdown-item" onClick={() => {}}>⚔️ 1v1 对战</Link>
          <Link to="/br" className="nav-dropdown-item" onClick={() => {}}>🔥 大逃杀</Link>
          <Link to="/daily" className="nav-dropdown-item" onClick={() => {}}>📅 每日挑战</Link>
        </Dropdown>

        <Dropdown label="🔍 发现">
          <Link to="/season" className="nav-dropdown-item" onClick={() => {}}>🏆 赛季通行证</Link>
        <Link to="/leaderboard" className="nav-dropdown-item" onClick={() => {}}>🏅 排行榜</Link>
          <Link to="/games" className="nav-dropdown-item" onClick={() => {}}>🗺️ 藏宝游戏</Link>
          <Link to="/bounties" className="nav-dropdown-item" onClick={() => {}}>💰 悬赏</Link>
          <Link to="/marketplace" className="nav-dropdown-item" onClick={() => {}}>📚 题库市场</Link>
        </Dropdown>

        <Link to="/community" className="nav-link">💬 社区</Link>
        <Link to="/teams" className="nav-link">👥 团队</Link>
        <Link to="/my-events" className="nav-link">📋 我的活动</Link>

        {user?.role === "admin" ? (
          <Link to="/admin/reviews" className="nav-link nav-link-admin">⚙️ 审核</Link>
        ) : null}
      </div>

      <div className="nav-right">
        <Link to="/notifications" className="nav-notif-bell" title="通知">
          🔔
          {unread > 0 ? <span className="nav-notif-badge">{unread > 99 ? "99+" : unread}</span> : null}
        </Link>
        <Link to="/profile" className="nav-user-btn">
          <span className="nav-user-avatar">{(user?.username || "?")[0].toUpperCase()}</span>
          <div className="nav-user-text">
            <span className="nav-user-name">{user?.username || "探索者"}</span>
            <span className="nav-user-role">{user?.role === "admin" ? "管理员" : "玩家"}</span>
          </div>
        </Link>
        <button type="button" className="nav-logout-btn" onClick={handleLogout} title="退出登录">
          <span className="nav-logout-icon">⏻</span>
        </button>
      </div>
    </nav>
  );
}
