import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPosts } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import FilterBar from "../components/FilterBar.jsx";
import PostCard from "../components/PostCard.jsx";

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ category: "", region: "" });

  useEffect(() => {
    setStatus("loading");
    fetchPosts({
      category: filters.category || undefined,
      region: filters.region || undefined
    })
      .then((data) => { setPosts(data.items); setStatus("ready"); })
      .catch((err) => { setError(err.message); setStatus("error"); });
  }, [filters]);

  const filterConfig = [
    {
      key: "category", label: "分类", value: filters.category,
      options: [
        { value: "lost_item", label: "🔍 寻物" },
        { value: "found_item", label: "📦 失物招领" },
        { value: "missing_person", label: "🚨 寻人" },
        { value: "announcement", label: "📢 通告" },
        { value: "other", label: "💬 其他" }
      ]
    },
    { key: "region", label: "区域", value: filters.region, placeholder: "输入地区" }
  ];

  if (status === "loading") return <div className="status-shell">加载社区帖子...</div>;
  if (status === "error") return <div className="status-shell">加载失败：{error}</div>;

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Community</p>
          <h1>社区信息</h1>
          <p className="hero-copy">寻物、寻人、公告——信息交流的平台。</p>
        </div>
        {isAuthenticated ? (
          <button className="primary-btn" onClick={() => navigate("/community/create")}>发布帖子</button>
        ) : null}
      </section>

      <section className="card filter-card">
        <FilterBar filters={filterConfig} onChange={setFilters} />
      </section>

      <section className="card-grid">
        {posts.length ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="card empty-card"><p>暂无帖子</p></div>
        )}
      </section>
    </main>
  );
}
