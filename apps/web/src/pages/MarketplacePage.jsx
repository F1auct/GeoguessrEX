import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

export default function MarketplacePage() {
  const { token } = useAuth();
  const [banks, setBanks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/marketplace`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setBanks(d.items); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [token]);

  async function buy(bankId, price) {
    if (!window.confirm(`确定花 ${price} 金币购买此题库？`)) return;
    try {
      const r = await fetch(`${API_BASE}/marketplace/buy`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bankId })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg("购买成功！去管理页面即可使用。");
      setBanks(prev => prev.map(b => b.id === bankId ? { ...b, isPurchased: true } : b));
    } catch (e) { setMsg(e.message); }
  }

  if (status === "loading") return <div className="status-shell">加载题库市场...</div>;

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Marketplace</p>
          <h1>题库市场</h1>
          <p className="hero-copy">购买优质题库，平台抽成20%。你也可以在管理页将题库挂牌出售。</p>
        </div>
      </section>
      {msg ? <div className="detail-toast" onClick={() => setMsg("")}>{msg}</div> : null}
      {!banks.length ? (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>📚</span>
          <strong>暂无挂牌题库</strong>
          <p>去管理页将你的题库设为付费即可挂牌出售。</p>
        </div>
      ) : (
        <div className="card-grid">
          {banks.map(b => (
            <div key={b.id} className="card game-card">
              <div className="game-card-head">
                <span className="badge badge-coin">💰 {b.price} 金币</span>
                <span className="badge badge-region">{b.questionCount} 题</span>
              </div>
              <h3>{b.title}</h3>
              <div className="game-card-meta">
                <span>作者：{b.ownerUsername}</span>
                <span>售出 {b.purchaseCount} 次</span>
              </div>
              {!b.isOwner && !b.isPurchased ? (
                <button className="primary-btn" style={{ marginTop: 12, width: "100%" }} onClick={() => buy(b.id, b.price)}>购买</button>
              ) : b.isPurchased ? (
                <p className="success-text">✅ 已购买</p>
              ) : <p className="form-help">你自己的题库</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
