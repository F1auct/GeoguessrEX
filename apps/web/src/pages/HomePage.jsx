import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchGroups } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function HomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadGroups() {
    const items = await fetchGroups(token);
    setGroups(items);
    setSelectedGroupId((current) => current || items[0]?.id || "");
    return items;
  }

  useEffect(() => {
    loadGroups()
      .then(() => setStatus("ready"))
      .catch((err) => {
        if (err.status === 401) {
          navigate("/login");
          return;
        }
        setError(err.message);
        setStatus("error");
      });
  }, [token]);

  const editableCount = groups.filter((group) => group.canEdit).length;

  if (status === "loading") {
    return <div className="status-shell">正在加载首页...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  return (
    <main className="landing-shell">
      <section className="landing-panel">
        <p className="hero-kicker">Geo Search</p>
        <h1>一个地图，一段故事</h1>
        <p className="hero-copy">
          先选择一个题库组，再进入街景猜点。你也可以在这里新增题目，或者管理整个题库。
        </p>

        <div className="group-picker">
          <label className="group-picker-label">
            <span>选择题库组</span>
            <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}（{group.count} 题）
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="landing-actions">
          <button
            className="primary-btn landing-btn"
            onClick={() => navigate(`/game/${selectedGroupId}`)}
            disabled={!selectedGroupId}
          >
            开始答题
          </button>
          <button
            className="secondary-btn landing-btn-secondary"
            onClick={() => navigate("/create")}
            disabled={!editableCount}
          >
            添加题目
          </button>
          <button className="secondary-btn landing-btn-secondary" onClick={() => navigate("/manage")}>
            管理题库
          </button>
        </div>
      </section>
    </main>
  );
}
