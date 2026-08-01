import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deletePost, fetchPost } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import MediaGallery from "../components/MediaGallery.jsx";
import CommentSection from "../components/CommentSection.jsx";

const CATEGORY_CONFIG = {
  lost_item: { label: "寻物启事", icon: "🔍", color: "#b44d28", bg: "rgba(180, 77, 40, 0.08)" },
  found_item: { label: "失物招领", icon: "📦", color: "#244c47", bg: "rgba(36, 76, 71, 0.08)" },
  missing_person: { label: "寻人启事", icon: "🚨", color: "#c0392b", bg: "rgba(192, 57, 43, 0.08)" },
  announcement: { label: "通告", icon: "📢", color: "#2c3e50", bg: "rgba(44, 62, 80, 0.06)" },
  other: { label: "其他信息", icon: "💬", color: "#5b625a", bg: "rgba(19, 26, 30, 0.04)" }
};

export default function PostDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPost(id)
      .then(setPost)
      .then(() => setStatus("ready"))
      .catch((err) => { setError(err.message); setStatus("error"); });
  }, [id]);

  async function handleDelete() {
    if (!window.confirm("确定删除此帖子？")) return;
    try { await deletePost(id, token); navigate("/community"); }
    catch (err) { setError(err.message); }
  }

  if (status === "loading") return <div className="status-shell">加载帖子...</div>;
  if (status === "error") return <div className="status-shell"><p>加载失败：{error}</p><button className="secondary-btn" onClick={() => navigate("/community")}>返回列表</button></div>;
  if (!post) return <div className="status-shell">帖子不存在</div>;

  const cfg = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG.other;
  const isAuthor = user?.id === post.authorId;

  return (
    <main className="page-shell">
      <button className="detail-back-link" onClick={() => navigate("/community")}>← 返回社区</button>

      {/* Hero */}
      <section className="detail-hero">
        <span className="detail-hero-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
        <h1>{post.title}</h1>
        <div className="detail-hero-meta">
          <span className="detail-avatar">{post.authorUsername?.[0]?.toUpperCase() || "?"}</span>
          <span className="detail-author-name">{post.authorUsername}</span>
          <span className="detail-dot">·</span>
          <span>{new Date(post.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          {post.region ? <><span className="detail-dot">·</span><span>📍 {post.region}</span></> : null}
          {post.status !== "approved" ? <span className="detail-status-badge">{post.status === "pending_review" ? "审核中" : post.status}</span> : null}
        </div>
      </section>

      {/* 内容 */}
      <section className="detail-body">
        {post.content ? (
          <div className="detail-text">{post.content}</div>
        ) : (
          <p className="detail-empty-text">发布者未提供文字描述</p>
        )}

        {post.mediaList?.length > 0 ? (
          <div className="detail-media-section">
            <h3>📷 图片 / 视频</h3>
            <MediaGallery mediaList={post.mediaList} />
          </div>
        ) : null}
      </section>

      {/* 信息条 + 联系方式 */}
      <div className="detail-info-strip">
        <div className="detail-info-item"><span>发布者</span><strong>{post.authorUsername}</strong></div>
        <div className="detail-info-item"><span>分类</span><strong>{cfg.icon} {cfg.label}</strong></div>
        <div className="detail-info-item"><span>区域</span><strong>{post.region || "未指定"}</strong></div>
        <div className="detail-info-item"><span>状态</span><strong style={{ color: cfg.color }}>{post.status === "approved" ? "✅ 已发布" : post.status === "pending_review" ? "⏳ 审核中" : "❌ 已拒绝"}</strong></div>
      </div>

      {post.contactInfo ? (
        <div className="detail-contact-bar">
          <span>📞 联系方式：</span><strong>{post.contactInfo}</strong>
        </div>
      ) : null}

      <CommentSection targetType="community_post" targetId={post.id} />

      {isAuthor ? (
        <div className="detail-actions">
          <button className="secondary-btn danger-btn" onClick={handleDelete}>删除此帖子</button>
        </div>
      ) : null}
    </main>
  );
}
