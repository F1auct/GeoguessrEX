import { useNavigate } from "react-router-dom";

const STATUS_LABELS = {
  active: "进行中",
  closed: "已结束",
  expired: "已过期"
};

export default function BountyCard({ bounty }) {
  const navigate = useNavigate();

  return (
    <div className="card game-card" onClick={() => navigate(`/bounties/${bounty.id}`)} style={{ cursor: "pointer" }}>
      <div className="game-card-head">
        <span className={`badge badge-${bounty.status}`}>{STATUS_LABELS[bounty.status] || bounty.status}</span>
        <span className="badge badge-coin">💰 {bounty.rewardCoin} 金币</span>
      </div>
      <h3>{bounty.title}</h3>
      {bounty.description ? <p className="card-desc">{bounty.description}</p> : null}
      <div className="game-card-meta">
        <span>发布者：{bounty.creatorUsername}</span>
        <span>截止：{new Date(bounty.deadline).toLocaleString("zh-CN")}</span>
      </div>
    </div>
  );
}
