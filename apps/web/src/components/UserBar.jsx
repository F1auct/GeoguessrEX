export default function UserBar({ user, onLogout }) {
  return (
    <div className="user-bar">
      <div className="hud-chip hud-chip-user">
        <span>玩家</span>
        <strong>{user?.username || "探险者"}</strong>
        <button type="button" onClick={onLogout}>
          登出
        </button>
      </div>
    </div>
  );
}
