import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { closeBounty, fetchBounty, submitBountyAnswer } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import MediaGallery from "../components/MediaGallery.jsx";

const STATUS_CONFIG = {
  active: { label: "进行中", icon: "🟢", color: "#1a5c4a", bg: "rgba(36, 76, 71, 0.08)" },
  closed: { label: "已结束", icon: "🔴", color: "#b44d28", bg: "rgba(180, 77, 40, 0.08)" },
  expired: { label: "已过期", icon: "⏰", color: "#5b625a", bg: "rgba(19, 26, 30, 0.05)" }
};

export default function BountyDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [bounty, setBounty] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [guess, setGuess] = useState({ lat: "", lng: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    fetchBounty(id)
      .then((data) => { setBounty(data); setStatus("ready"); })
      .catch((err) => { setError(err.message); setStatus("error"); });
  }, [id]);

  useEffect(() => {
    if (!bounty || bounty.status !== "active") return;
    function tick() {
      const diff = new Date(bounty.deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("已截止"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${d > 0 ? d + "天 " : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [bounty]);

  const elapsedPercent = useMemo(() => {
    if (!bounty) return 0;
    const total = new Date(bounty.deadline).getTime() - new Date(bounty.createdAt).getTime();
    const elapsed = Date.now() - new Date(bounty.createdAt).getTime();
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [bounty]);

  async function handleSubmit() {
    setSubmitting(true); setError("");
    try {
      const res = await submitBountyAnswer(id, { lat: Number(guess.lat), lng: Number(guess.lng) }, token);
      setResult(res);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleClose() {
    if (!window.confirm("确定提前关闭此悬赏？赏金将退还。")) return;
    try {
      await closeBounty(id, token);
      const updated = await fetchBounty(id);
      setBounty(updated);
    } catch (err) { setError(err.message); }
  }

  if (status === "loading") return <div className="status-shell">加载悬赏详情...</div>;
  if (status === "error") return <div className="status-shell"><p>加载失败：{error}</p><button className="secondary-btn" onClick={() => navigate("/bounties")}>返回列表</button></div>;
  if (!bounty) return <div className="status-shell">悬赏不存在</div>;

  const cfg = STATUS_CONFIG[bounty.status] || STATUS_CONFIG.expired;
  const isCreator = user?.id === bounty.creatorId;
  const isActive = bounty.status === "active";
  const isWinner = user?.id === bounty.winnerId;

  return (
    <main className="page-shell">
      <button className="detail-back-link" onClick={() => navigate("/bounties")}>← 返回悬赏列表</button>

      {/* Hero */}
      <section className="detail-hero">
        <div className="detail-hero-top">
          <div>
            <span className="detail-hero-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
            <h1>{bounty.title}</h1>
            <div className="detail-hero-meta">
              <span className="detail-avatar">{bounty.creatorUsername?.[0]?.toUpperCase() || "?"}</span>
              <span className="detail-author-name">{bounty.creatorUsername}</span>
              <span className="detail-dot">·</span>
              <span>{new Date(bounty.createdAt).toLocaleDateString("zh-CN")}</span>
            </div>
          </div>
          <div className="detail-hero-reward">
            <div className="detail-reward-ring">
              <svg viewBox="0 0 100 100" width="100" height="100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(214, 184, 143, 0.2)" strokeWidth="7" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="url(#bg)" strokeWidth="7"
                  strokeDasharray={`${(elapsedPercent / 100) * 276.5} 276.5`}
                  strokeLinecap="round" transform="rotate(-90 50 50)" />
                <defs>
                  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#b44d28" /><stop offset="100%" stopColor="#7f2d15" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="detail-reward-center">
                <span className="detail-reward-amount">{bounty.rewardCoin.toLocaleString()}</span>
                <span className="detail-reward-unit">金币</span>
              </div>
            </div>
            {isActive && timeLeft ? <div className="detail-countdown">{timeLeft}</div> : null}
          </div>
        </div>
      </section>

      {/* 信息条 */}
      <div className="detail-info-strip">
        <div className="detail-info-item"><span>发布者</span><strong>{bounty.creatorUsername}</strong></div>
        <div className="detail-info-item"><span>状态</span><strong style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</strong></div>
        <div className="detail-info-item"><span>截止</span><strong>{new Date(bounty.deadline).toLocaleString("zh-CN")}</strong></div>
        <div className="detail-info-item"><span>赏金</span><strong style={{ color: "#b44d28" }}>💰 {bounty.rewardCoin} 金币</strong></div>
      </div>

      {/* 描述 + 媒体 */}
      <section className="detail-body">
        {bounty.description ? <div className="detail-text">{bounty.description}</div> : <p className="detail-empty-text">发布者未提供额外描述，请根据坐标线索寻找目标地点。</p>}
        {bounty.questionData?.mediaList?.length > 0 ? (
          <div className="detail-media-section"><h3>📷 线索素材</h3><MediaGallery mediaList={bounty.questionData.mediaList} /></div>
        ) : null}
      </section>

      {/* 结果 */}
      {result ? (
        <div className="detail-result-bar">
          {result.submission.won ? (
            <><span>🎉</span><strong>恭喜答对！获得了 {bounty.rewardCoin} 金币赏金！</strong><span>距离 {result.submission.distanceKm.toFixed(2)} km · 得分 {result.submission.score}</span></>
          ) : (
            <><span>📊</span><strong>距离 {result.submission.distanceKm.toFixed(2)} km · 得分 {result.submission.score}</strong><span>未达 ≥4000 标准</span><button className="secondary-btn" onClick={() => setResult(null)} style={{ marginLeft: 12 }}>重新提交</button></>
          )}
        </div>
      ) : null}

      {/* 答题 */}
      {isActive && !isCreator && !result ? (
        <div className="detail-guess-bar">
          <strong>🎯 提交你的答案</strong>
          <input type="number" step="any" placeholder="纬度" value={guess.lat} onChange={(e) => setGuess((p) => ({ ...p, lat: e.target.value }))} />
          <input type="number" step="any" placeholder="经度" value={guess.lng} onChange={(e) => setGuess((p) => ({ ...p, lng: e.target.value }))} />
          <button className="primary-btn" onClick={handleSubmit} disabled={submitting || !guess.lat || !guess.lng}>
            {submitting ? "提交中..." : "🚀 提交"}
          </button>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {isWinner ? <div className="detail-winner-bar">🌟 你赢得了这笔赏金！</div> : null}
      {isCreator && isActive ? <div className="detail-actions"><button className="secondary-btn danger-btn" onClick={handleClose}>提前关闭（退还赏金）</button></div> : null}
      {!isActive ? (
        <div className={`detail-closed-bar ${bounty.status}`}>
          <span>{bounty.status === "closed" ? "🏁" : "⏰"}</span>
          <strong>{bounty.status === "closed" ? "悬赏已结束" : "悬赏已过期"}</strong>
          <span>{bounty.status === "closed" ? (bounty.winnerId ? "已有玩家获得赏金。" : "发布者已提前关闭。") : "未产生获奖者，赏金已退还。"}</span>
        </div>
      ) : null}
    </main>
  );
}
