import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchGames } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import FilterBar from "../components/FilterBar.jsx";
import GameCard from "../components/GameCard.jsx";

export default function GamesHubPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ region: "", gameType: "" });

  const loadGames = useCallback(() => {
    setStatus("loading");
    fetchGames({
      region: filters.region || undefined,
      gameType: filters.gameType || undefined
    })
      .then((data) => {
        setGames(data.items);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [filters]);

  useEffect(() => { loadGames(); }, [loadGames]);

  const filterConfig = [
    {
      key: "gameType",
      label: "游戏类型",
      value: filters.gameType,
      options: [
        { value: "treasure_hunt", label: "🗺️ 藏宝" },
        { value: "reasoning", label: "🧩 推理" }
      ]
    },
    { key: "region", label: "区域", value: filters.region, placeholder: "输入地区筛选" }
  ];

  if (status === "loading") return <div className="status-shell">加载游戏列表...</div>;
  if (status === "error") return <div className="status-shell">加载失败：{error}</div>;

  return (
    <main className="page-shell">
      <section className="page-header card">
        <div>
          <p className="hero-kicker">Games Hub</p>
          <h1>藏宝 & 推理游戏</h1>
          <p className="hero-copy">探索城市、解开谜题，加入线下推理与藏宝冒险。</p>
        </div>
        {isAuthenticated ? (
          <button className="primary-btn" onClick={() => navigate("/games/create")}>
            创建游戏
          </button>
        ) : null}
      </section>

      <section className="card filter-card">
        <FilterBar filters={filterConfig} onChange={setFilters} />
      </section>

      <section className="card-grid">
        {games.length ? (
          games.map((game) => <GameCard key={game.id} game={game} />)
        ) : (
          <div className="card empty-card"><p>暂无游戏</p></div>
        )}
      </section>
    </main>
  );
}
