import { useEffect, useState } from "react";

const API_BASE = "http://localhost:3001/api";

const TYPES = [
  { key: "score", label: "答题高分", unit: "分" },
  { key: "bounty", label: "悬赏获胜", unit: "次" },
  { key: "hunt", label: "藏宝通关", unit: "次" },
  { key: "community", label: "社区贡献", unit: "篇" },
  { key: "wealth", label: "财富排行", unit: "金币" },
];

const PERIODS = [
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "all", label: "总榜" },
];

const MEDALS = ["Gold", "Silver", "Bronze"];

export default function LeaderboardPage() {
  const [type, setType] = useState("score");
  const [period, setPeriod] = useState("week");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!items.length) setStatus("loading");
    fetch(`${API_BASE}/leaderboard?type=${type}&period=${period}`)
      .then((res) => { if (!res.ok) throw new Error("加载失败"); return res.json(); })
      .then((data) => { if (!cancelled) { setItems(data.items || []); setStatus("ready"); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setStatus("error"); } });
    return () => { cancelled = true; };
  }, [type, period]);

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Leaderboard</p>
          <h1>排行榜</h1>
          <p className="hero-copy">看看谁是本周/本月/历史最强玩家。</p>
        </div>
      </section>

      {/* 维度切换 */}
      <div className="lb-type-tabs">
        {TYPES.map((t) => (
          <button key={t.key} className={`lb-type-tab ${type === t.key ? "active" : ""}`}
            onClick={() => setType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 时间切换 */}
      <div className="lb-period-tabs">
        {PERIODS.map((p) => (
          <button key={p.key} className={`filter-tab ${period === p.key ? "active" : ""}`}
            onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* 排行列表 */}
      {status === "loading" ? (
        <div className="lb-loading">加载排行榜...</div>
      ) : status === "error" ? (
        <div className="lb-loading">加载失败：{error}</div>
      ) : !items.length ? (
        <div className="lb-empty">
          <strong>暂无排行数据</strong>
          <p>快去玩一局游戏，成为第一个上榜的人</p>
        </div>
      ) : (
        <div className="lb-list">
          {items.map((item, i) => (
            <div key={item.userId} className={`lb-item ${i < 3 ? "lb-top3" : ""}`}>
              <div className="lb-rank">
                {i < 3 ? (
                  <span className={`lb-medal lb-medal-${i}`}>{MEDALS[i]}</span>
                ) : (
                  <span className="lb-rank-num">{i + 1}</span>
                )}
              </div>
              <div className="lb-user">
                <span className="lb-avatar">{item.username?.[0]?.toUpperCase() || "?"}</span>
                <strong>{item.username}</strong>
              </div>
              <div className="lb-value">{item.display}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
