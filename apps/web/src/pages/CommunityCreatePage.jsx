import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPost } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import MediaUploader from "../components/MediaUploader.jsx";

const CATEGORIES = [
  { value: "lost_item", label: "🔍 寻物" },
  { value: "found_item", label: "📦 失物招领" },
  { value: "missing_person", label: "🚨 寻人" },
  { value: "announcement", label: "📢 通告" },
  { value: "other", label: "💬 其他" }
];

export default function CommunityCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", content: "", category: "other", region: "", contactInfo: "" });
  const [mediaList, setMediaList] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const result = await createPost({ ...form, mediaList }, token);
      navigate(`/community/${result.post.id}`);
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">New Post</p>
          <h1>发布帖子</h1>
          <p className="hero-copy">图片、视频、文字可任意组合发布。发布后需审核通过才公开显示。</p>
        </div>
        <button className="secondary-btn" onClick={() => navigate("/community")}>返回列表</button>
      </section>

      <form className="card editor-form" onSubmit={handleSubmit}>
        <label><span>标题</span><input name="title" value={form.title} onChange={handleChange} required /></label>
        <div className="form-row">
          <label>
            <span>分类</span>
            <select name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label><span>区域</span><input name="region" value={form.region} onChange={handleChange} placeholder="武汉" /></label>
        </div>
        <label><span>文字内容</span><textarea name="content" value={form.content} onChange={handleChange} rows={6} placeholder="描述详情..." /></label>

        <div className="eyebrow">图片/视频（可选）</div>
        <MediaUploader mediaList={mediaList} onChange={setMediaList} />

        <label><span>联系方式（选填）</span><input name="contactInfo" value={form.contactInfo} onChange={handleChange} placeholder="QQ/微信/电话" /></label>

        <div className="form-actions">
          <button className="primary-btn" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "发布中..." : "发布帖子（提交审核）"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>
    </main>
  );
}
