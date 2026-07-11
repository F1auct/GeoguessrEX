import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  approveRegistration, completeGameStep, fetchGame,
  fetchGameProgress, fetchGameRegistrations, registerForGame
} from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import MediaGallery from "../components/MediaGallery.jsx";
import RegistrationForm from "../components/RegistrationForm.jsx";

export default function GameDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [showRegForm, setShowRegForm] = useState(false);
  const [progress, setProgress] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [actionMsg, setActionMsg] = useState("");

  const isCreator = user?.id === game?.creatorId;

  const loadGame = useCallback(() => {
    return fetchGame(id).then(setGame);
  }, [id]);

  useEffect(() => {
    loadGame().then(() => setStatus("ready")).catch((err) => { setError(err.message); setStatus("error"); });
  }, [loadGame]);

  useEffect(() => {
    if (!token || !id) return;
    fetchGameProgress(id, token).then(setProgress).catch(() => setProgress(null));
  }, [token, id]);

  useEffect(() => {
    if (!isCreator || !token || !id) return;
    fetchGameRegistrations(id, token).then((data) => setRegistrations(data.items)).catch(() => {});
  }, [isCreator, token, id]);

  async function handleRegister(playerInfo) {
    try { await registerForGame(id, playerInfo, token); setShowRegForm(false); setActionMsg("报名成功，等待审核。"); }
    catch (err) { setError(err.message); }
  }

  async function handleApprove(regId, action) {
    try {
      await approveRegistration(id, regId, action, token);
      const data = await fetchGameRegistrations(id, token);
      setRegistrations(data.items);
    } catch (err) { setError(err.message); }
  }

  async function handleCompleteStep() {
    if (!navigator.geolocation) { setError("浏览器不支持定位"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await completeGameStep(id, { userLat: pos.coords.latitude, userLng: pos.coords.longitude }, token);
        setActionMsg(`✅ 完成「${res.stepTitle}」！${res.nextLocationHint ? `下一提示：${res.nextLocationHint}` : res.isAllDone ? "🎉 全部完成！" : ""}`);
        const updated = await fetchGameProgress(id, token);
        setProgress(updated);
      } catch (err) { setError(err.message); }
    }, () => setError("无法获取位置信息"));
  }

  if (status === "loading") return <div className="status-shell">加载游戏详情...</div>;
  if (status === "error") return <div className="status-shell"><p>加载失败：{error}</p><button className="secondary-btn" onClick={() => navigate("/games")}>返回列表</button></div>;
  if (!game) return <div className="status-shell">游戏不存在</div>;

  return (
    <main className="page-shell">
      <button className="detail-back-link" onClick={() => navigate("/games")}>← 返回游戏列表</button>

      {/* Hero */}
      <section className="detail-hero">
        <div className="detail-hero-top">
          <div>
            <span className="detail-hero-badge" style={{ background: "rgba(36, 76, 71, 0.08)", color: "#1a5c4a" }}>
              {game.gameType === "treasure_hunt" ? "🗺️ 藏宝" : "🧩 推理"}
            </span>
            <h1>{game.title}</h1>
            <div className="detail-hero-meta">
              <span className="detail-avatar">{game.creatorUsername?.[0]?.toUpperCase() || "?"}</span>
              <span className="detail-author-name">{game.creatorUsername}</span>
              <span className="detail-dot">·</span>
              <span>{game.region || "不限区域"}</span>
              <span className="detail-dot">·</span>
              <span>{game.locationTasks?.length || 0} 个地点</span>
              <span className={`detail-status-badge`}>{game.status === "pending_review" ? "审核中" : game.status === "approved" ? "已批准" : game.status === "active" ? "进行中" : game.status === "completed" ? "已完成" : game.status}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 信息条 */}
      <div className="detail-info-strip">
        <div className="detail-info-item"><span>类型</span><strong>{game.gameType === "treasure_hunt" ? "🗺️ 藏宝" : "🧩 推理"}</strong></div>
        <div className="detail-info-item"><span>状态</span><strong>{game.status}</strong></div>
        <div className="detail-info-item"><span>区域</span><strong>{game.region || "不限"}</strong></div>
        <div className="detail-info-item"><span>发布者</span><strong>{game.creatorUsername}</strong></div>
        <div className="detail-info-item"><span>地点数</span><strong>{game.locationTasks?.length || 0}</strong></div>
      </div>

      {actionMsg ? <div className="detail-toast">{actionMsg}</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {/* 描述 */}
      {game.description ? (
        <section className="detail-body"><div className="detail-text">{game.description}</div></section>
      ) : null}

      {game.mediaList?.length > 0 ? (
        <section className="detail-body"><h3>📷 游戏素材</h3><MediaGallery mediaList={game.mediaList} /></section>
      ) : null}

      {/* 流程步骤 */}
      <section className="detail-body">
        <h3>📋 游戏流程</h3>
        <div className="flow-steps">
          {game.locationTasks?.map((task, i) => (
            <div key={task.id} className="flow-step">
              <div className="flow-step-num">{i + 1}</div>
              <div>
                <strong>{task.title}</strong>
                {task.description ? <p>{task.description}</p> : null}
                {task.arrivalHint ? <p className="hint-text">💡 到达：{task.arrivalHint}</p> : null}
                {task.nextLocationHint ? <p className="hint-text">🧭 下一站：{task.nextLocationHint}</p> : null}
                <MediaGallery mediaList={task.taskConfig?.mediaList} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 报名 / 状态提示 */}
      {user && (game.status === "approved" || game.status === "active") ? (
        isCreator ? (
          <div className="detail-action-bar detail-action-bar-hint">
            <span>ℹ️ 这是你创建的游戏，你可以管理报名但不能自己参加。如需测试，请用其他账号登录。</span>
          </div>
        ) : progress ? (
          <div className="detail-action-bar detail-action-bar-hint">
            <span>✅ 你已报名，等待发起人审核通过后即可参与。</span>
          </div>
        ) : (
          <div className="detail-action-bar">
            {!showRegForm ? (
              game.requirePlayerInfo ? (
                <button className="primary-btn" onClick={() => setShowRegForm(true)}>
                  📝 报名参加（需提供个人信息）
                </button>
              ) : (
                <button className="primary-btn" onClick={() => handleRegister({})}>
                  📝 直接报名参加
                </button>
              )
            ) : (
              <RegistrationForm playerInfoFields={game.playerInfoFields} onSubmit={handleRegister} onCancel={() => setShowRegForm(false)} />
            )}
          </div>
        )
      ) : null}

      {/* 进度 */}
      {progress?.currentTask ? (
        <div className="detail-action-bar">
          <strong>📍 当前：{progress.currentTask.title}（{progress.currentStep + 1}/{progress.totalSteps}）</strong>
          {progress.currentTask.arrivalHint ? <p className="hint-text">💡 {progress.currentTask.arrivalHint}</p> : null}
          <button className="primary-btn" onClick={handleCompleteStep}>📍 到达验证</button>
          {progress.completedSteps?.length > 0 ? (
            <div className="completed-list">
              {progress.completedSteps.map((s) => (
                <p key={s.step} className="hint-text">✅ {s.taskTitle} — {new Date(s.completedAt).toLocaleString("zh-CN")}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 报名管理 */}
      {isCreator && registrations.length > 0 ? (
        <section className="detail-body">
          <h3>👥 报名管理 ({registrations.length})</h3>
          {registrations.map((reg) => (
            <div key={reg.id} className="reg-item">
              <div>
                <strong>{reg.username}</strong>
                <span> — {reg.status === "pending" ? "待审核" : reg.status === "approved" ? "已通过" : "已拒绝"}</span>
                {reg.playerInfo && Object.keys(reg.playerInfo).length > 0 ? (
                  <p>{Object.entries(reg.playerInfo).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                ) : null}
              </div>
              {reg.status === "pending" ? (
                <div className="detail-inline-actions">
                  <button className="primary-btn" onClick={() => handleApprove(reg.id, "approved")}>通过</button>
                  <button className="secondary-btn danger-btn" onClick={() => handleApprove(reg.id, "rejected")}>拒绝</button>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
