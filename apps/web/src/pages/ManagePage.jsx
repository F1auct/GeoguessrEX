import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "../contexts/AuthContext.jsx";

const scenicImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=80"
];

function emptyGroupForm() {
  return { id: "", title: "" };
}

function emptyQuestionForm(groupId = "new") {
  return {
    id: "",
    title: "",
    description: "",
    groupId,
    sourceType: "street_view",
    imageUrl: "",
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

export default function ManagePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [groupForm, setGroupForm] = useState(emptyGroupForm());
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm());
  const [editingQuestionId, setEditingQuestionId] = useState("");
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
  const editableGroups = useMemo(() => groups.filter((group) => group.canEdit), [groups]);

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

  async function handleQuestionSubmit(event) {
    event.preventDefault();
    setError("");

    const payload = {
      id: questionForm.id.trim(),
      title: questionForm.title.trim(),
      description: questionForm.description.trim(),
      groupId: questionForm.groupId,
      sourceType: questionForm.sourceType,
      imageUrl: questionForm.imageUrl.trim() || undefined,
      lat: questionForm.sourceType === "image" ? toNumber(questionForm.lat) : undefined,
      lng: questionForm.sourceType === "image" ? toNumber(questionForm.lng) : undefined,
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
        await updateQuestion(editingQuestionId, payload, token);
      } else {
        await createQuestion(payload, token);
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
      sourceType: question.sourceType || "street_view",
      imageUrl: question.imageUrl || "",
      lat: String(question.streetView.lat),
      lng: String(question.streetView.lng),
      heading: String(question.streetView.heading),
      pitch: String(question.streetView.pitch),
      fov: String(question.streetView.fov),
      panoId: question.streetView.panoId || ""
    });
  }

  async function handleDeleteQuestion(question) {
    const shouldDelete = window.confirm(`确定删除题目“${question.title}”吗？此操作不可撤销。`);
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

      <section className="hero-panel workflow-banner">
        <div className="workflow-points">
          <div>
            <span>01</span>
            <strong>创建题库</strong>
          </div>
          <div>
            <span>02</span>
            <strong>选择题库</strong>
          </div>
          <div>
            <span>03</span>
            <strong>添加题目</strong>
          </div>
        </div>
        <p className="form-help">
          当前共有 {groups.length} 个题库，其中 {editableGroups.length} 个可以编辑。
        </p>
      </section>

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
                  <strong>{question.title}</strong>
                  <p>{question.description || "暂无地点介绍"}</p>
                  <span>{question.id}</span>
                </div>
                {question.canEdit ? (
                  <div className="question-item-actions">
                    <button className="secondary-btn" onClick={() => handleEditQuestion(question)}>
                      编辑
                    </button>
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
                    ? "你可以直接在下面补第一道题。"
                    : "先选中你自己的题库，才能在下面新建或编辑题目。"}
                </p>
              </div>
            ) : null}
          </div>

          {selectedGroup?.canEdit ? (
            <form className="manage-form" onSubmit={handleQuestionSubmit}>
              <div className="section-heading section-heading-inline">
                <div>
                  <div className="eyebrow">题目录入</div>
                  <h2>{editingQuestionId ? "编辑题目" : "添加新题目"}</h2>
                </div>
              </div>

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
                  <span>归属题库</span>
                  <select
                    value={questionForm.groupId}
                    onChange={(event) => setQuestionForm((current) => ({ ...current, groupId: event.target.value }))}
                  >
                    {editableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>题目类型</span>
                  <select
                    value={questionForm.sourceType}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, sourceType: event.target.value }))
                    }
                  >
                    <option value="street_view">街景题</option>
                    <option value="image">图片题</option>
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
                {questionForm.sourceType === "image" ? (
                  <label className="form-grid-wide">
                    <span>图片地址</span>
                    <input
                      value={questionForm.imageUrl}
                      onChange={(event) =>
                        setQuestionForm((current) => ({ ...current, imageUrl: event.target.value }))
                      }
                      placeholder="/uploads/questions/example.jpg"
                      required
                    />
                  </label>
                ) : null}
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
                  {editingQuestionId ? "保存题目" : "添加题目"}
                </button>
                {editingQuestionId ? (
                  <button className="secondary-btn" type="button" onClick={() => resetQuestionForm()}>
                    取消编辑
                  </button>
                ) : null}
              </div>
            </form>
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
