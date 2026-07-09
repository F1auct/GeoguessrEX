import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createGroup,
  deleteGroup,
  deleteQuestion,
  fetchGroups,
  fetchQuestionsByGroup,
  updateGroup
} from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const scenicImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=80"
];

function emptyGroupForm() {
  return { id: "", title: "" };
}

export default function ManagePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [groupForm, setGroupForm] = useState(emptyGroupForm());
  const [editingGroupId, setEditingGroupId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("loading");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  async function loadGroups(nextGroupId = "") {
    const items = await fetchGroups(token);
    setGroups(items);
    const targetGroupId = nextGroupId || selectedGroupId || items[0]?.id || "";
    setSelectedGroupId(targetGroupId);
    return { items, targetGroupId };
  }

  async function loadQuestions(groupId) {
    if (!groupId) {
      setQuestions([]);
      return;
    }
    const data = await fetchQuestionsByGroup(groupId, token);
    setQuestions(data.items);
  }

  useEffect(() => {
    setStatus("loading");
    Promise.resolve()
      .then(async () => {
        const { targetGroupId } = await loadGroups();
        await loadQuestions(targetGroupId);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }

    loadQuestions(selectedGroupId).catch((err) => {
      setError(err.message);
    });
  }, [selectedGroupId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % scenicImages.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, []);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  function resetGroupForm() {
    setGroupForm(emptyGroupForm());
    setEditingGroupId("");
  }

  async function handleGroupSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      if (editingGroupId) {
        await updateGroup(
          editingGroupId,
          {
            id: groupForm.id.trim(),
            title: groupForm.title.trim()
          },
          token
        );
      } else {
        await createGroup(
          {
            id: groupForm.id.trim(),
            title: groupForm.title.trim()
          },
          token
        );
      }

      const nextId = groupForm.id.trim();
      await loadGroups(nextId);
      await loadQuestions(nextId);
      resetGroupForm();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteGroup(group) {
    const shouldDelete = window.confirm(
      `确定删除题库“${group.title}”吗？该题库内所有题目都会一起删除，此操作不可撤销。`
    );
    if (!shouldDelete) {
      return;
    }

    setError("");
    try {
      await deleteGroup(group.id, token);
      const { targetGroupId } = await loadGroups();
      await loadQuestions(targetGroupId);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleEditGroup(group) {
    setEditingGroupId(group.id);
    setGroupForm({
      id: group.id,
      title: group.title
    });
  }

  async function handleDeleteQuestion(question) {
    const shouldDelete = window.confirm(`确定删除题目“${question.description || question.id}”吗？此操作不可撤销。`);
    if (!shouldDelete) {
      return;
    }

    setError("");
    try {
      await deleteQuestion(question.id, token);
      await loadGroups(selectedGroupId);
      await loadQuestions(selectedGroupId);
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === "loading") {
    return <div className="status-shell">正在加载管理页面...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  return (
    <main className="manage-shell landing-shell-cinematic">
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

      <section className="manage-header card">
        <div>
          <p className="hero-kicker">Question Bank Control</p>
          <h1>管理题库和题目</h1>
          <p className="hero-copy">左侧创建或选择题库，右侧管理题目。第一次使用时，先创建题库，再添加题目。</p>
        </div>
        <button className="secondary-btn" onClick={() => navigate("/")}>
          返回首页
        </button>
      </section>

      {error ? <p className="error-text manage-error">{error}</p> : null}

      <section className="manage-grid">
        <section className="card manage-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">题库列表</div>
            </div>
          </div>

          <div className="group-list">
            {groups.length ? (
              groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`group-item ${group.id === selectedGroupId ? "active" : ""}`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <strong>{group.title}</strong>
                  <span>
                    {group.id} · {group.count} 题
                  </span>
                </button>
              ))
            ) : (
              <div className="notice-card warning-card">
                <strong>还没有任何题库</strong>
                <p>先创建第一个题库，右侧才能继续维护题目。</p>
              </div>
            )}
          </div>

          <form className="manage-form" onSubmit={handleGroupSubmit}>
            <label>
              <span>题库 ID</span>
              <input
                value={groupForm.id}
                onChange={(event) => setGroupForm((current) => ({ ...current, id: event.target.value }))}
                placeholder="city-pack"
                required
              />
            </label>
            <label>
              <span>题库名称</span>
              <input
                value={groupForm.title}
                onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="城市题库"
                required
              />
            </label>
            <div className="manage-actions">
              <button className="primary-btn" type="submit">
                {editingGroupId ? "保存题库" : "创建题库"}
              </button>
              {editingGroupId ? (
                <button className="secondary-btn" type="button" onClick={resetGroupForm}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <div className="group-toolbar">
            {selectedGroup ? (
              selectedGroup.canEdit ? (
                <>
                  <button className="secondary-btn" onClick={() => handleEditGroup(selectedGroup)}>
                    编辑当前题库
                  </button>
                  <button className="secondary-btn danger-btn" onClick={() => handleDeleteGroup(selectedGroup)}>
                    删除当前题库
                  </button>
                </>
              ) : (
                <p className="empty-text">这个题库可以游玩，但不是你创建的，所以不能编辑。</p>
              )
            ) : null}
          </div>
        </section>

        <section className="card manage-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">题目列表</div>
              <h2>{selectedGroup ? `题库：${selectedGroup.title}` : "先选一个题库"}</h2>
            </div>
          </div>

          <div className="question-list">
            {questions.map((question) => (
              <article key={question.id} className="question-item">
                <div>
                  <strong>{question.description || "暂无地点介绍"}</strong>
                  <span>{question.id}</span>
                </div>
                {question.canEdit ? (
                  <div className="question-item-actions">
                    <button className="secondary-btn danger-btn" onClick={() => handleDeleteQuestion(question)}>
                      删除
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {!questions.length ? (
              <div className="notice-card">
                <strong>这个题库里还没有题目</strong>
                <p>
                  {selectedGroup?.canEdit
                    ? "点击下方「去新建题目」添加第一道题。"
                    : "先选中你自己的题库，才能新建题目。"}
                </p>
              </div>
            ) : null}
          </div>

          {selectedGroup?.canEdit ? (
            <div className="manage-form">
              <div className="section-heading section-heading-inline">
                <div>
                  <div className="eyebrow">题目录入</div>
                  <h2>添加新题目</h2>
                </div>
              </div>
              <p className="form-help">题目的新建统一在独立页面完成，字段更完整、支持街景链接解析与本地图片上传。</p>
              <div className="manage-actions">
                <button className="primary-btn" type="button" onClick={() => navigate("/create")}>
                  去新建题目
                </button>
              </div>
            </div>
          ) : (
            <div className="notice-card warning-card">
              <strong>还不能在这里补题</strong>
              <p>请选择你自己创建的题库，或者先在左侧新建一个题库，再继续添加题目。</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
