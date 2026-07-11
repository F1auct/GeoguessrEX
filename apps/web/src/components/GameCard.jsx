import { useNavigate } from "react-router-dom";

const TYPE_LABELS = {
  treasure_hunt: "🗺️ 藏宝",
  reasoning: "🧩 推理"
};

const STATUS_LABELS = {
  pending_review: "审核中",
  approved: "已批准",
  rejected: "已拒绝",
  active: "进行中",
  completed: "已完成"
};

export default function GameCard({ game }) {
  const navigate = useNavigate();

  return (
    <div className="card game-card" onClick={() => navigate(`/games/${game.id}`)} style={{ cursor: "pointer" }}>
      <div className="game-card-head">
        <span className="badge badge-type">{TYPE_LABELS[game.gameType] || game.gameType}</span>
        <span className={`badge badge-${game.status}`}>{STATUS_LABELS[game.status] || game.status}</span>
        {game.region ? <span className="badge badge-region">📍 {game.region}</span> : null}
      </div>
      <h3>{game.title}</h3>
      {game.description ? <p className="card-desc">{game.description}</p> : null}
      <div className="game-card-meta">
        <span>{game.taskCount || game.locationTasks?.length || 0} 个地点</span>
        <span>{game.playerCount || 0} 人参与</span>
        <span>发布者：{game.creatorUsername}</span>
      </div>
    </div>
  );
}
