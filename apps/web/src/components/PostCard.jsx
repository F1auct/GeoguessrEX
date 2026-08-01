import { useNavigate } from "react-router-dom";

const CATEGORY_LABELS = {
  lost_item: "🔍 寻物",
  found_item: "📦 失物招领",
  missing_person: "🚨 寻人",
  announcement: "📢 通告",
  other: "💬 其他"
};

export default function PostCard({ post }) {
  const navigate = useNavigate();

  return (
    <div className="card game-card" onClick={() => navigate(`/community/${post.id}`)} style={{ cursor: "pointer" }}>
      <div className="game-card-head">
        <span className="badge badge-type">{CATEGORY_LABELS[post.category] || post.category}</span>
        {post.region ? <span className="badge badge-region">📍 {post.region}</span> : null}
        {post.status !== "approved" ? <span className="badge badge-pending">{post.status}</span> : null}
      </div>
      <h3>{post.title}</h3>
      <p className="card-desc">{post.content?.slice(0, 150)}{post.content?.length > 150 ? "..." : ""}</p>
      <div className="game-card-meta">
        <span>发布者：{post.authorUsername}</span>
        <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
      </div>
    </div>
  );
}
