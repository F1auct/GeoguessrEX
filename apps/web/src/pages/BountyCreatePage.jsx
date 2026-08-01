import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBounty } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import MediaUploader from "../components/MediaUploader.jsx";

export default function BountyCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    rewardCoin: "",
    deadline: "",
    lat: "",
    lng: ""
  });
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
      const result = await createBounty({
        title: form.title,
        description: form.description,
        rewardCoin: Number(form.rewardCoin),
        deadline: new Date(form.deadline).toISOString(),
        questionData: {
          lat: Number(form.lat),
          lng: Number(form.lng),
          mediaList: mediaList
        }
      }, token);

      navigate(`/bounties/${result.bounty.id}`);
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Create Bounty</p>
          <h1>发布悬赏</h1>
          <p className="hero-copy">设置目标坐标和赏金，可上传图片、视频和文字描述，看谁先找到准确位置。</p>
        </div>
        <button className="secondary-btn" onClick={() => navigate("/bounties")}>
          返回列表
        </button>
      </section>

      <form className="card editor-form" onSubmit={handleSubmit}>
        <label>
          <span>悬赏标题</span>
          <input name="title" value={form.title} onChange={handleChange} placeholder="寻找这座桥的位置" required />
        </label>
        <label>
          <span>文字描述</span>
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="补充线索或详细说明..." />
        </label>

        <div className="eyebrow">媒体素材（图片/视频，可选）</div>
        <MediaUploader mediaList={mediaList} onChange={setMediaList} />

        <div className="form-row">
          <label>
            <span>赏金（金币）</span>
            <input name="rewardCoin" type="number" min={1} value={form.rewardCoin} onChange={handleChange} placeholder="100" required />
          </label>
          <label>
            <span>截止时间</span>
            <input name="deadline" type="datetime-local" value={form.deadline} onChange={handleChange} required />
          </label>
        </div>
        <div className="eyebrow">目标坐标</div>
        <div className="form-row">
          <label>
            <span>纬度</span>
            <input name="lat" type="number" step="any" value={form.lat} onChange={handleChange} placeholder="39.9042" required />
          </label>
          <label>
            <span>经度</span>
            <input name="lng" type="number" step="any" value={form.lng} onChange={handleChange} placeholder="116.4074" required />
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-btn" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "发布中..." : "发布悬赏（将扣除金币）"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>
    </main>
  );
}
