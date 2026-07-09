import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function UserBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="user-bar">
      <div className="hud-chip hud-chip-user">
        <span>{user?.role === "admin" ? "管理员" : "玩家"}</span>
        <strong>{user?.username || "探索者"}</strong>
        <button type="button" onClick={handleLogout}>
          退出
        </button>
      </div>
    </div>
  );
}
