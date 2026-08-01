import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchBounties } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import BountyCard from "../components/BountyCard.jsx";

export default function BountiesPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [bounties, setBounties] = useState([]);
  const [filter, setFilter] = useState("active");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus("loading");
    fetchBounties(filter)
      .then((data) => {
        setBounties(data.items);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [filter]);

  if (status === "loading") {
    return <div className="status-shell">加载悬赏列表...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Bounties</p>
          <h1>悬赏题目</h1>
          <p className="hero-copy">发布悬赏，第一个答对的玩家即可获得赏金。</p>
        </div>
        {isAuthenticated ? (
          <button className="primary-btn" onClick={() => navigate("/bounties/create")}>
            发布悬赏
          </button>
        ) : null}
      </section>

      <section className="filter-row">
        {["active", "closed", "expired"].map((s) => (
          <button
            key={s}
            className={`filter-tab ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "active" ? "进行中" : s === "closed" ? "已结束" : "已过期"}
          </button>
        ))}
      </section>

      <section className="card-grid">
        {bounties.length ? (
          bounties.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} />)
        ) : (
          <div className="card empty-card">
            <p>暂无悬赏题目</p>
          </div>
        )}
      </section>
    </main>
  );
}
