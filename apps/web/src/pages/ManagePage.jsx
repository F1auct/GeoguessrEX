import { useEffect, useMemo, useState } from "react";
import {
  createGroup,
  createQuestion,
  deleteGroup,
  deleteQuestion,
  fetchGroups,
  fetchQuestionsByGroup,
  updateGroup,
  updateQuestion
} from "../services/api.js";

function emptyGroupForm() {
  return { id: "", title: "" };
}

function emptyQuestionForm(groupId = "new") {
  return {
    id: "",
    title: "",
    description: "",
    groupId,
    lat: "",
    lng: "",
    heading: "0",
    pitch: "0",
    fov: "100",
    panoId: ""
  };
}

function toNumber(value) {
  return Number.parseFloat(value);
}

export default function ManagePage({ onBack }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [groupForm, setGroupForm] = useState(emptyGroupForm());
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm());
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("loading");

  async function loadGroups(nextGroupId = "") {
    const items = await fetchGroups();
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
    const data = await fetchQuestionsByGroup(groupId);
    setQuestions(data.items);
  }

  useEffect(() => {
    setStatus("loading");
    Promise.resolve()
      .then(async () => {
        const { targetGroupId } = await loadGroups();
        await loadQuestions(targetGroupId);
        setQuestionForm(emptyQuestionForm(targetGroupId || "new"));
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
    setQuestionForm((current) => ({
      ...current,
      groupId: selectedGroupId
    }));
  }, [selectedGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  function resetQuestionForm(groupId = selectedGroupId || "new") {
    setQuestionForm(emptyQuestionForm(groupId));
    setEditingQuestionId("");
  }

  function resetGroupForm() {
    setGroupForm(emptyGroupForm());
    setEditingGroupId("");
  }

  async function handleGroupSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      if (editingGroupId) {
        await updateGroup(editingGroupId, {
          id: groupForm.id.trim(),
          title: groupForm.title.trim()
        });
      } else {
        await createGroup({
          id: groupForm.id.trim(),
          title: groupForm.title.trim()
        });
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
      `确定删除题库组“${group.title}”吗？该组内所有题目都会被删除，这个操作不能撤销。`
    );
    if (!shouldDelete) {
      return;
    }

    setError("");
    try {
      await deleteGroup(group.id);
      const { targetGroupId } = await loadGroups();
      await loadQuestions(targetGroupId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleQuestionSubmit(event) {
    event.preventDefault();
    setError("");

    const payload = {
      id: questionForm.id.trim(),
      title: questionForm.title.trim(),
      description: questionForm.description.trim(),
      groupId: questionForm.groupId,
      streetView: {
        lat: toNumber(questionForm.lat),
        lng: toNumber(questionForm.lng),
        heading: toNumber(questionForm.heading),
        pitch: toNumber(questionForm.pitch),
        fov: toNumber(questionForm.fov),
        panoId: questionForm.panoId.trim() || null
      }
    };

    try {
      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, payload);
      } else {
        await createQuestion(payload);
      }

      await loadGroups(questionForm.groupId);
      await loadQuestions(questionForm.groupId);
      resetQuestionForm(questionForm.groupId);
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

  function handleEditQuestion(question) {
    setEditingQuestionId(question.id);
    setQuestionForm({
      id: question.id,
      title: question.title,
      description: question.description || "",
      groupId: question.groupId,
      lat: String(question.streetView.lat),
      lng: String(question.streetView.lng),
      heading: String(question.streetView.heading),
      pitch: String(question.streetView.pitch),
      fov: String(question.streetView.fov),
      panoId: question.streetView.panoId || ""
    });
  }

  async function handleDeleteQuestion(question) {
    const shouldDelete = window.confirm(
      `确定删除题目“${question.title}”吗？这个操作不能撤销。`
    );
    if (!shouldDelete) {
      return;
    }

    setError("");
    try {
      await deleteQuestion(question.id);
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
    <main className="manage-shell">
      <section className="manage-header card">
        <div>
          <p className="hero-kicker">题库管理</p>
          <h1>管理题库组和题目</h1>
          <p className="hero-copy">你可以自由新增、修改、删除题库组和其中的题目。</p>
        </div>
        <button className="secondary-btn" onClick={onBack}>
          返回首页
        </button>
      </section>

      {error ? <p className="error-text manage-error">{error}</p> : null}

      <section className="manage-grid">
        <section className="card manage-card">
          <div className="eyebrow">题库组</div>
          <div className="group-list">
            {groups.map((group) => (
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
            ))}
          </div>

          <form className="manage-form" onSubmit={handleGroupSubmit}>
            <label>
              <span>题库组 ID</span>
              <input
                value={groupForm.id}
                onChange={(event) => setGroupForm((current) => ({ ...current, id: event.target.value }))}
                placeholder="city-pack"
                required
              />
            </label>
            <label>
              <span>题库组名称</span>
              <input
                value={groupForm.title}
                onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="城市题库"
                required
              />
            </label>
            <div className="manage-actions">
              <button className="primary-btn" type="submit">
                {editingGroupId ? "保存题库组" : "新增题库组"}
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
              <>
                <button className="secondary-btn" onClick={() => handleEditGroup(selectedGroup)}>
                  编辑当前题库组
                </button>
                <button className="secondary-btn danger-btn" onClick={() => handleDeleteGroup(selectedGroup)}>
                  删除当前题库组
                </button>
              </>
            ) : null}
          </div>
        </section>

        <section className="card manage-card">
          <div className="eyebrow">题目列表</div>
          <div className="question-list">
            {questions.map((question) => (
              <article key={question.id} className="question-item">
                <div>
                  <strong>{question.title}</strong>
                  <p>{question.description || "暂无地点介绍"}</p>
                  <span>{question.id}</span>
                </div>
                <div className="question-item-actions">
                  <button className="secondary-btn" onClick={() => handleEditQuestion(question)}>
                    编辑
                  </button>
                  <button className="secondary-btn danger-btn" onClick={() => handleDeleteQuestion(question)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
            {!questions.length ? <p className="empty-text">当前题库组还没有题目。</p> : null}
          </div>

          <form className="manage-form" onSubmit={handleQuestionSubmit}>
            <div className="form-grid">
              <label>
                <span>题目 ID</span>
                <input
                  value={questionForm.id}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, id: event.target.value }))}
                  placeholder="q10"
                  required
                />
              </label>
              <label>
                <span>题目标题</span>
                <input
                  value={questionForm.title}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="巴黎街头"
                  required
                />
              </label>
              <label>
                <span>所属题库组</span>
                <select
                  value={questionForm.groupId}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, groupId: event.target.value }))}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>纬度</span>
                <input
                  value={questionForm.lat}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, lat: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>经度</span>
                <input
                  value={questionForm.lng}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, lng: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Heading</span>
                <input
                  value={questionForm.heading}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, heading: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Pitch</span>
                <input
                  value={questionForm.pitch}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, pitch: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>FOV</span>
                <input
                  value={questionForm.fov}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, fov: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Pano ID</span>
                <input
                  value={questionForm.panoId}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, panoId: event.target.value }))}
                />
              </label>
              <label className="form-grid-wide">
                <span>地点介绍</span>
                <textarea
                  rows={4}
                  value={questionForm.description}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="manage-actions">
              <button className="primary-btn" type="submit">
                {editingQuestionId ? "保存题目" : "新增题目"}
              </button>
              {editingQuestionId ? (
                <button className="secondary-btn" type="button" onClick={() => resetQuestionForm()}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
