import { useEffect, useState } from "react";
import { fetchTransactions, fetchWallet, rechargeWallet, withdrawWallet } from "../services/api.js";

const API_BASE = "http://localhost:3001/api";
import { useAuth } from "../contexts/AuthContext.jsx";

const TXN_LABELS = {
  recharge: "充值", withdraw: "提现", bounty_reward: "悬赏奖励",
  bounty_create: "创建悬赏", bounty_refund: "退款"
};

const TXN_COLORS = {
  recharge: "var(--green)",
  withdraw: "var(--accent-dark)",
  bounty_reward: "var(--green)",
  bounty_create: "var(--accent-dark)",
  bounty_refund: "var(--muted)"
};

export default function ProfilePage() {
  const { token, user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState("recharge");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [badges, setBadges] = useState({ badges: [], total: 0 });

  function loadData() {
    setStatus("loading");
    Promise.all([
      fetchWallet(token).catch(() => null),
      fetchTransactions(token).catch(() => ({ items: [] })),
      fetch(`${API_BASE}/badges/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ badges: [], total: 0 }))
    ])
      .then(([walletData, txnData, badgeData]) => {
        setWallet(walletData);
        setTransactions(txnData.items);
        setBadges(badgeData);
        setStatus("ready");
      })
      .catch((err) => { setError(err.message); setStatus("error"); });
  }

  useEffect(() => { loadData(); }, [token]);

  async function handleWalletAction(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    const num = Number(amount);
    if (!Number.isInteger(num) || num <= 0) {
      setError("金额必须为正整数");
      return;
    }
    try {
      if (action === "recharge") {
        const res = await rechargeWallet(num, token);
        setMsg(`充值成功！当前余额：${res.balanceCoin} 金币`);
      } else {
        const res = await withdrawWallet(num, token);
        setMsg(`提现成功！当前余额：${res.balanceCoin} 金币`);
      }
      setAmount("");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === "loading") return <div className="status-shell">加载个人中心...</div>;
  if (status === "error") return <div className="status-shell">加载失败：{error}</div>;

  const balance = wallet?.balanceCoin ?? 0;

  return (
    <main className="page-shell">
      {/* 顶部 Hero */}
      <section className="profile-hero">
        <div className="profile-hero-bg" />
        <div className="profile-hero-content">
          <div className="profile-avatar">
            <span className="profile-avatar-text">
              {(user?.username || "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="profile-hero-info">
            <h1>{user?.username || "探索者"}</h1>
            <div className="profile-hero-meta">
              <span className="profile-role-badge">
                {user?.role === "admin" ? "管理员" : "玩家"}
              </span>
              <span>{user?.email}</span>
              <span>注册于 {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "-"}</span>
            </div>
          </div>
          <div className="profile-hero-balance">
            <div className="profile-balance-card">
              <span className="profile-balance-label">我的金币</span>
              <strong className="profile-balance-num">{balance.toLocaleString()}</strong>
              <span className="profile-balance-unit">金币</span>
            </div>
          </div>
        </div>
      </section>

      {/* 徽章 */}
      <section className="card profile-badges-card">
        <h3>🏅 成就徽章 <span className="profile-badge-count">{badges.badges?.length || 0}/{badges.total}</span></h3>
        {badges.badges?.length > 0 ? (
          <div className="profile-badges-grid">
            {badges.badges.map((badge) => (
              <div key={badge.id} className="profile-badge-item" style={{ borderColor: badge.color }}>
                <span className="profile-badge-icon">{badge.icon}</span>
                <strong style={{ color: badge.color }}>{badge.name}</strong>
                <span className="profile-badge-rarity" style={{ color: badge.color }}>{badge.rarity}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">还没有获得徽章，多玩玩吧！</p>
        )}
      </section>

      {/* 充值 / 提现 */}
      <section className="profile-actions-row">
        <div className="card profile-action-card">
          <div className="profile-action-icon">💳</div>
          <h3>充值 / 提现</h3>
          <p className="profile-action-desc">1 金币 = 1 元人民币（模拟支付）</p>
          <form className="profile-action-form" onSubmit={handleWalletAction}>
            <div className="profile-action-tabs">
              <button
                type="button"
                className={`profile-tab ${action === "recharge" ? "active" : ""}`}
                onClick={() => setAction("recharge")}
              >
                充值
              </button>
              <button
                type="button"
                className={`profile-tab ${action === "withdraw" ? "active" : ""}`}
                onClick={() => setAction("withdraw")}
              >
                提现
              </button>
            </div>
            <div className="profile-action-input-row">
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="输入金额"
                required
              />
              <span className="profile-input-unit">金币</span>
            </div>
            <button className="primary-btn profile-submit-btn" type="submit">
              {action === "recharge" ? "立即充值" : "立即提现"}
            </button>
          </form>
          {msg ? <p className="success-text">{msg}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="card profile-stats-card">
          <div className="profile-action-icon">📊</div>
          <h3>账户概览</h3>
          <div className="profile-stats-grid">
            <div className="profile-stat-item">
              <span className="profile-stat-num">{(transactions.filter((t) => t.type === "bounty_reward").length)}</span>
              <span className="profile-stat-label">获奖次数</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-num">{(transactions.filter((t) => t.type === "recharge").length)}</span>
              <span className="profile-stat-label">充值次数</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-num">{transactions.length}</span>
              <span className="profile-stat-label">总交易数</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-num">
                {transactions
                  .filter((t) => t.type === "recharge")
                  .reduce((sum, t) => sum + t.amount, 0)
                  .toLocaleString()}
              </span>
              <span className="profile-stat-label">累计充值</span>
            </div>
          </div>
        </div>
      </section>

      {/* 交易记录 */}
      <section className="card profile-txn-card">
        <div className="profile-txn-header">
          <h3>交易记录</h3>
          <span className="profile-txn-count">共 {transactions.length} 笔</span>
        </div>
        {transactions.length ? (
          <div className="profile-txn-list">
            {transactions.map((txn) => (
              <div key={txn.id} className="profile-txn-item">
                <div className="profile-txn-icon" style={{ background: TXN_COLORS[txn.type] || "var(--muted)" }}>
                  {txn.type === "recharge" ? "↓" : txn.type === "withdraw" ? "↑" : txn.type.includes("reward") ? "🎁" : txn.type.includes("refund") ? "↩" : "●"}
                </div>
                <div className="profile-txn-body">
                  <strong>{TXN_LABELS[txn.type] || txn.type}</strong>
                  <span>{new Date(txn.createdAt).toLocaleString("zh-CN")}</span>
                </div>
                <div className="profile-txn-amounts">
                  <span className="profile-txn-before">前 {txn.balanceBefore}</span>
                  <span className="profile-txn-arrow">→</span>
                  <span className="profile-txn-after">后 {txn.balanceAfter}</span>
                </div>
                <div className={`profile-txn-delta ${txn.type === "recharge" || txn.type === "bounty_reward" || txn.type === "bounty_refund" ? "is-plus" : "is-minus"}`}>
                  {txn.type === "recharge" || txn.type === "bounty_reward" || txn.type === "bounty_refund" ? "+" : "-"}
                  {txn.amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-txn-empty">
            <span className="profile-txn-empty-icon">📭</span>
            <p>暂无交易记录</p>
            <p className="form-help">充值或参与悬赏后，记录会显示在这里</p>
          </div>
        )}
      </section>
    </main>
  );
}
