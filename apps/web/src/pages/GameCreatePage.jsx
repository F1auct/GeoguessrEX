import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createGame } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import MediaUploader from "../components/MediaUploader.jsx";

export default function GameCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", gameType: "treasure_hunt", region: "",
    requirePlayerInfo: false, playerInfoFields: ""
  });
  const [gameMediaList, setGameMediaList] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function addTask() {
    setTasks((prev) => [...prev, {
      title: "", description: "", targetLat: "", targetLng: "",
      arrivalHint: "", nextLocationHint: "", taskType: "gps_check",
      mediaList: []
    }]);
  }

  function removeTask(index) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTask(index, field, value) {
    setTasks((prev) => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      await createGame({
        title: form.title,
        description: form.description,
        gameType: form.gameType,
        region: form.region,
        requirePlayerInfo: form.requirePlayerInfo,
        playerInfoFields: form.playerInfoFields.split(",").map((s) => s.trim()).filter(Boolean),
        mediaList: gameMediaList,
        locationTasks: tasks.map((t) => ({
          title: t.title,
          description: t.description,
          arrivalHint: t.arrivalHint,
          nextLocationHint: t.nextLocationHint,
          targetLat: Number(t.targetLat),
          targetLng: Number(t.targetLng),
          taskType: t.taskType,
          taskConfig: { mediaList: t.mediaList || [] }
        }))
      }, token);
      navigate("/games");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Create Game</p>
          <h1>创建藏宝/推理游戏</h1>
        </div>
        <button className="secondary-btn" onClick={() => navigate("/games")}>返回列表</button>
      </section>

      <form className="card editor-form" onSubmit={handleSubmit}>
        <label><span>游戏标题</span><input name="title" value={form.title} onChange={handleChange} required /></label>
        <label><span>文字描述</span><textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="游戏背景、规则说明..." /></label>

        <div className="eyebrow">游戏素材（图片/视频，可选）</div>
        <MediaUploader mediaList={gameMediaList} onChange={setGameMediaList} />

        <div className="form-row">
          <label>
            <span>游戏类型</span>
            <select name="gameType" value={form.gameType} onChange={handleChange}>
              <option value="treasure_hunt">🗺️ 藏宝</option>
              <option value="reasoning">🧩 推理</option>
            </select>
          </label>
          <label><span>区域</span><input name="region" value={form.region} onChange={handleChange} placeholder="武汉" /></label>
        </div>

        <label className="checkbox-label">
          <input name="requirePlayerInfo" type="checkbox" checked={form.requirePlayerInfo} onChange={handleChange} />
          <span>需要玩家提供信息才能报名</span>
        </label>
        {form.requirePlayerInfo ? (
          <label>
            <span>需要的信息字段（逗号分隔）</span>
            <input name="playerInfoFields" value={form.playerInfoFields} onChange={handleChange} placeholder="name, phone" />
          </label>
        ) : null}

        <div className="eyebrow">地点任务（按顺序执行）</div>
        {tasks.map((task, i) => (
          <div key={i} className="card task-card">
            <div className="task-card-head">
              <strong>第 {i + 1} 步</strong>
              <button type="button" className="secondary-btn danger-btn" onClick={() => removeTask(i)}>删除</button>
            </div>
            <label><span>标题</span><input value={task.title} onChange={(e) => updateTask(i, "title", e.target.value)} required /></label>
            <label><span>描述</span><textarea value={task.description} onChange={(e) => updateTask(i, "description", e.target.value)} rows={2} /></label>

            <div className="eyebrow">步骤素材</div>
            <MediaUploader
              mediaList={task.mediaList || []}
              onChange={(list) => updateTask(i, "mediaList", list)}
            />

            <div className="form-row">
              <label><span>纬度</span><input type="number" step="any" value={task.targetLat} onChange={(e) => updateTask(i, "targetLat", e.target.value)} required /></label>
              <label><span>经度</span><input type="number" step="any" value={task.targetLng} onChange={(e) => updateTask(i, "targetLng", e.target.value)} required /></label>
            </div>
            <label><span>到达提示</span><input value={task.arrivalHint} onChange={(e) => updateTask(i, "arrivalHint", e.target.value)} placeholder="玩家到达此地点时显示的提示" /></label>
            <label><span>下一地点提示</span><input value={task.nextLocationHint} onChange={(e) => updateTask(i, "nextLocationHint", e.target.value)} placeholder="完成后给出的下一地点线索" /></label>
            <label>
              <span>验证方式</span>
              <select value={task.taskType} onChange={(e) => updateTask(i, "taskType", e.target.value)}>
                <option value="gps_check">GPS 定位校验</option>
                <option value="photo_upload">拍照上传</option>
              </select>
            </label>
          </div>
        ))}
        <button type="button" className="secondary-btn" onClick={addTask}>+ 添加地点</button>

        <div className="form-actions">
          <button className="primary-btn" type="submit" disabled={status === "submitting" || tasks.length === 0}>
            {status === "submitting" ? "创建中..." : "创建游戏（提交审核）"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>
    </main>
  );
}
