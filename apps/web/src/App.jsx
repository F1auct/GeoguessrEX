import { useEffect, useState } from "react";
import GamePage from "./pages/GamePage.jsx";
import CreateMapPage from "./pages/CreateMapPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";
import { fetchGroups } from "./services/api.js";

function HomePage({ groups, selectedGroupId, onSelectGroup, onStart, onOpenCreate, onOpenManage }) {
  return (
    <main className="landing-shell">
      <section className="landing-panel">
        <p className="hero-kicker">Geo Search</p>
        <h1>从街景里判断你身在何处</h1>
        <p className="hero-copy">
          先选择一个题库组，再进入街景猜点。你也可以在这里新增题目，或者管理整个题库。
        </p>

        <div className="group-picker">
          <label className="group-picker-label">
            <span>选择题库组</span>
            <select value={selectedGroupId} onChange={(event) => onSelectGroup(event.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}（{group.count} 题）
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="landing-actions">
          <button className="primary-btn landing-btn" onClick={onStart} disabled={!selectedGroupId}>
            开始答题
          </button>
          <button className="secondary-btn landing-btn-secondary" onClick={onOpenCreate}>
            添加题目
          </button>
          <button className="secondary-btn landing-btn-secondary" onClick={onOpenManage}>
            管理题库
          </button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadGroups() {
    const items = await fetchGroups();
    setGroups(items);
    setSelectedGroupId((current) => current || items[0]?.id || "");
    return items;
  }

  useEffect(() => {
    loadGroups()
      .then(() => {
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  if (status === "loading") {
    return <div className="status-shell">正在加载首页...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  if (page === "create") {
    return (
      <CreateMapPage
        groups={groups}
        onBack={async () => {
          await loadGroups();
          setPage("home");
        }}
        onCreated={loadGroups}
      />
    );
  }

  if (page === "manage") {
    return (
      <ManagePage
        onBack={async () => {
          await loadGroups();
          setPage("home");
        }}
      />
    );
  }

  if (page === "game" && selectedGroup) {
    return <GamePage group={selectedGroup} onBack={() => setPage("home")} />;
  }

  return (
    <HomePage
      groups={groups}
      selectedGroupId={selectedGroupId}
      onSelectGroup={setSelectedGroupId}
      onStart={() => setPage("game")}
      onOpenCreate={() => setPage("create")}
      onOpenManage={() => setPage("manage")}
    />
  );
}
