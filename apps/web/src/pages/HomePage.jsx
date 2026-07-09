import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchGroups } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const scenicImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=80"
];

export default function HomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showPrerequisiteCard, setShowPrerequisiteCard] = useState(false);

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
  }, [token, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % scenicImages.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, []);

  const editableGroups = useMemo(() => groups.filter((group) => group.canEdit), [groups]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  function handleAddQuestionClick() {
    if (!editableGroups.length) {
      setShowPrerequisiteCard(true);
      return;
    }
    navigate("/create");
  }

  if (status === "loading") {
    return <div className="status-shell">正在加载首页...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  return (
    <main className="landing-shell landing-shell-editorial landing-shell-cinematic">
      <div className="auth-backdrop card page-backdrop">
        <div className="scenic-stage-images">
          {scenicImages.map((image, index) => (
            <div
              key={image}
              className={`scenic-stage-image ${index === activeImageIndex ? "active" : ""}`}
              style={{ backgroundImage: `url(${image})` }}
            />
          ))}
        </div>
        <div className="auth-backdrop-overlay" />
      </div>
      <section className="landing-panel landing-panel-rich">
        <div className="landing-copy landing-copy-single">
          <p className="hero-kicker">GeoGuessrEX</p>
          <h1 className="display-title">
            <span>Pick the bank.</span>
            <span>Start the round.</span>
          </h1>

          <div className="landing-summary-bar">
            <div className="summary-pill">
              <span>题库总数</span>
              <strong>{groups.length}</strong>
            </div>
            <div className="summary-pill">
              <span>可编辑题库</span>
              <strong>{editableGroups.length}</strong>
            </div>
            <div className="summary-pill">
              <span>当前选择</span>
              <strong>{selectedGroup?.title || "暂无题库"}</strong>
            </div>
          </div>

          <div className="card current-bank-panel">
            <div className="group-picker current-bank-picker">
              <label className="group-picker-label">
                <span>当前题库</span>
                <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                  {groups.length ? (
                    groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title} ({group.count} 题)
                      </option>
                    ))
                  ) : (
                    <option value="">暂无题库</option>
                  )}
                </select>
              </label>
              {selectedGroup ? <p className="form-help current-bank-id">{selectedGroup.id}</p> : null}
            </div>

            <div className="landing-actions current-bank-actions">
              <button
                className="primary-btn landing-btn"
                onClick={() => navigate(`/game/${selectedGroupId}`)}
                disabled={!selectedGroupId}
              >
                开始游戏
              </button>
              <button className="secondary-btn landing-btn-secondary" onClick={handleAddQuestionClick}>
                添加题目
              </button>
              <button className="secondary-btn landing-btn-secondary" onClick={() => navigate("/manage")}>
                管理题库
              </button>
            </div>

            {showPrerequisiteCard ? (
              <div className="notice-card warning-card inline-popup-card">
                <div className="inline-popup-head">
                  <strong>你还没有可编辑题库</strong>
                  <button
                    type="button"
                    className="ghost-btn"
                    aria-label="关闭提示"
                    onClick={() => setShowPrerequisiteCard(false)}
                  >
                    ×
                  </button>
                </div>
                <p>题目必须先归属到一个题库。先去创建题库，创建完成后再回来添加题目。</p>
                <div className="manage-actions">
                  <button className="primary-btn" type="button" onClick={() => navigate("/manage")}>
                    去创建题库
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
