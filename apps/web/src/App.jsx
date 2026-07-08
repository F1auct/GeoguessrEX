import { useEffect, useState } from "react";
import AuthPage from "./pages/AuthPage.jsx";
import GamePage from "./pages/GamePage.jsx";
import CreateMapPage from "./pages/CreateMapPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";
import UserBar from "./components/UserBar.jsx";
import { fetchGroups, fetchCurrentUser } from "./services/api.js";

const tokenStorageKey = "geoguesr.authToken";

function HomePage({ groups, selectedGroupId, onSelectGroup, onStart, onOpenCreate, onOpenManage }) {
  const editableCount = groups.filter((group) => group.canEdit).length;
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
          <button className="secondary-btn landing-btn-secondary" onClick={onOpenCreate} disabled={!editableCount}>
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

  const [session, setSession] = useState({
    status: "checking",
    token: localStorage.getItem(tokenStorageKey) || "",
    user: null
  });

  useEffect(() => {
    if (!session.token) {
      setSession({ status: "guest", token: "", user: null });
      return;
    }

    let isCurrent = true;

    fetchCurrentUser(session.token)
      .then(({ user }) => {
        if (isCurrent) {
          setSession((current) => ({
            ...current,
            status: "authenticated",
            user
          }));
        }
      })
      .catch(() => {
        localStorage.removeItem(tokenStorageKey);
        if (isCurrent) {
          setSession({ status: "guest", token: "", user: null });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [session.token]);

  function handleAuthenticated({ token, user }) {
    localStorage.setItem(tokenStorageKey, token);
    setSession({
      status: "authenticated",
      token,
      user
    });
  }

  function handleLogout() {
    localStorage.removeItem(tokenStorageKey);
    setSession({ status: "guest", token: "", user: null });
  }

  function handleUnauthorized() {
    handleLogout();
  }

  async function loadGroups() {
    const items = await fetchGroups(session.token);
    setGroups(items);
    setSelectedGroupId((current) => current || items[0]?.id || "");
    return items;
  }

  useEffect(() => {
    if (session.status !== "authenticated") return;

    loadGroups()
      .then(() => {
        setStatus("ready");
      })
      .catch((err) => {
        if (err.status === 401) {
          handleUnauthorized();
          return;
        }
        setError(err.message);
        setStatus("error");
      });
  }, [session.status]);

  if (session.status === "checking") {
    return <div className="status-shell">Checking session...</div>;
  }

  if (session.status !== "authenticated") {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  if (status === "loading") {
    return <div className="status-shell">正在加载首页...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const isGamePage = page === "game" && selectedGroup;

  const pageContent = (() => {
    if (page === "create") {
      return (
        <CreateMapPage
          groups={groups}
          token={session.token}
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
          token={session.token}
          onBack={async () => {
            await loadGroups();
            setPage("home");
          }}
        />
      );
    }

    if (isGamePage) {
      return (
        <GamePage
          group={selectedGroup}
          token={session.token}
          user={session.user}
          onBack={() => setPage("home")}
          onLogout={handleLogout}
          onUnauthorized={handleUnauthorized}
        />
      );
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
  })();

  return (
    <>
      {!isGamePage && <UserBar user={session.user} onLogout={handleLogout} />}
      {pageContent}
    </>
  );
}
