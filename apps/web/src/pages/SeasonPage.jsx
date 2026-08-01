import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

const TAB_LABELS = {
  pass: "赛季奖励",
  quests: "赛季任务",
  leaderboard: "排行榜",
};

const QUEST_GROUP_LABELS = {
  daily: "日常任务",
  weekly: "周常任务",
  season: "赛季任务",
};

export default function SeasonPage() {
  const { token, user } = useAuth();
  const [season, setSeason] = useState(null);
  const [pass, setPass] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quests, setQuests] = useState(null);
  const [tab, setTab] = useState("pass");
  const [status, setStatus] = useState("loading");

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    Promise.all([
      fetch(`${API}/season`).then((r) => r.json()),
      token
        ? fetch(`${API}/season/pass`, { headers: authHeaders })
            .then((r) => r.json())
            .catch(() => null)
        : null,
      fetch(`${API}/season/leaderboard`).then((r) => r.json()),
      token
        ? fetch(`${API}/quests`, { headers: authHeaders })
            .then((r) => r.json())
            .catch(() => null)
        : null,
    ])
      .then(([s, p, lb, q]) => {
        setSeason(s);
        setPass(p);
        setLeaderboard(lb.items || []);
        setQuests(q);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  async function claimQuest(questId) {
    try {
      const res = await fetch(`${API}/quests/${questId}/claim`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.claimed) {
        const [qRes, pRes] = await Promise.all([
          fetch(`${API}/quests`, { headers: authHeaders }),
          fetch(`${API}/season/pass`, { headers: authHeaders }),
        ]);
        setQuests(await qRes.json());
        setPass(await pRes.json());
      }
    } catch {}
  }

  if (status === "loading") {
    return <div className="status-shell">加载赛季数据...</div>;
  }

  if (!season) {
    return <div className="status-shell">暂无赛季数据</div>;
  }

  const userLevel = pass?.level || 1;
  const userXp = pass?.xp || 0;
  const progress = pass?.progress || 0;
  const endDate = new Date(season.endDate);
  const daysLeft = Math.max(
    0,
    Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  );

  // progress ring: circumference = 2*PI*52 ≈ 326.7
  const ringCircumference = 326.7;
  const ringOffset = ringCircumference * (1 - progress / 100);

  return (
    <main className="season-page">
      {/* Hero */}
      <section className="season-hero">
        <div className="season-hero-inner">
          <div className="season-hero-info">
            <span className="season-hero-badge">SEASON PASS</span>
            <h1>{season.name}</h1>
            <p className="season-hero-theme">
              {season.theme} / 剩余 <strong>{daysLeft}</strong> 天
            </p>
            <p className="season-hero-dates">
              {new Date(season.startDate).toLocaleDateString("zh-CN")} -{" "}
              {new Date(season.endDate).toLocaleDateString("zh-CN")}
            </p>
          </div>

          <div className="season-hero-ring">
            <div className="season-level-ring">
              <svg viewBox="0 0 120 120" width="120" height="120">
                <defs>
                  <linearGradient
                    id="season-ring-grad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#b44d28" />
                    <stop offset="50%" stopColor="#c97d3a" />
                    <stop offset="100%" stopColor="#d6b88f" />
                  </linearGradient>
                </defs>
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#season-ring-grad)"
                  strokeWidth="8"
                  strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div className="season-level-center">
                <span className="season-level-num">{userLevel}</span>
                <span className="season-level-label">等级</span>
              </div>
            </div>
          </div>
        </div>

        <div className="season-progress-wrap">
          <div className="season-progress-bar">
            <div
              className="season-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="season-progress-text">
            {userXp.toLocaleString()} /{" "}
            {pass?.nextLevelXp?.toLocaleString() || "MAX"} XP
          </span>
        </div>
      </section>

      {/* Tabs */}
      <div className="season-tabs">
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`season-tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rewards Panel */}
      {tab === "pass" && (
        <section className="season-rewards">
          <h3>奖励轨道</h3>
          <div className="season-rewards-scroll">
            {(season.levels || []).map((lvl) => {
              const unlocked =
                pass &&
                (userLevel > lvl.level ||
                  (userLevel === lvl.level && progress >= 100));
              const current = pass && lvl.level === userLevel;
              let cardClass = "season-reward-card";
              if (unlocked && !current) cardClass += " unlocked";
              else if (current) cardClass += " current";
              else cardClass += " locked";

              let statusLabel = "锁定";
              if (unlocked && !current) statusLabel = "已解锁";
              else if (current) statusLabel = "当前等级";

              return (
                <div key={lvl.level} className={cardClass}>
                  <div className="season-reward-level">{lvl.level}</div>
                  <div className="season-reward-text">{lvl.reward}</div>
                  <div className="season-reward-xp">
                    {lvl.xp.toLocaleString()} XP
                  </div>
                  <div className="season-reward-status">{statusLabel}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Quests Panel */}
      {tab === "quests" && quests && (
        <section className="season-quests">
          {["daily", "weekly", "season"].map((qt) => {
            const items = quests[qt] || [];
            if (!items.length) return null;
            return (
              <div key={qt} className="season-quest-group">
                <h3>{QUEST_GROUP_LABELS[qt] || qt}</h3>
                {items.map((q) => {
                  const prog = q.progress || {};
                  const done = prog.completed;
                  const claimed = prog.claimed;
                  const pct = Math.min(
                    100,
                    Math.round(
                      ((prog.current_count || 0) / q.target_count) * 100
                    )
                  );
                  return (
                    <div
                      key={q.id}
                      className={`quest-card${claimed ? " claimed" : ""}`}
                    >
                      <div className="quest-status">
                        {claimed ? "OK" : done ? "!" : ""}
                      </div>
                      <div className="quest-body">
                        <strong>{q.title}</strong>
                        <p>{q.description}</p>
                        <div className="quest-progress-mini">
                          <div
                            className={`quest-progress-mini-fill${
                              done ? " done" : ""
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="quest-progress-label">
                          {prog.current_count || 0}/{q.target_count}
                        </span>
                      </div>
                      <div className="quest-reward">
                        <span className="quest-reward-xp">
                          +{q.reward_xp} XP
                        </span>
                        {q.reward_coin > 0 && (
                          <span className="quest-reward-coin">
                            +{q.reward_coin} Coin
                          </span>
                        )}
                        {done && !claimed && (
                          <button
                            className="quest-claim-btn"
                            onClick={() => claimQuest(q.id)}
                          >
                            领取
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      {/* Leaderboard */}
      {tab === "leaderboard" && (
        <section className="season-lb">
          <h3>赛季排行榜</h3>
          {leaderboard.length > 0 ? (
            <div className="season-lb-list">
              {leaderboard.map((item, i) => {
                const topClass =
                  i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
                const mine = item.userId === user?.id ? " mine" : "";
                return (
                  <div
                    key={item.userId}
                    className={`season-lb-item${topClass ? " " + topClass : ""}${mine}`}
                  >
                    <div className="season-lb-rank">{item.rank}</div>
                    <div className="season-lb-user">
                      <strong>{item.username}</strong>
                      <span className="season-lb-level">
                        Lv.{item.level}
                      </span>
                    </div>
                    <div className="season-lb-xp">
                      {item.xp.toLocaleString()} XP
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="team-lb-empty">暂无排行</p>
          )}
        </section>
      )}

      {/* XP Sources */}
      <div className="season-xp-sources">
        <span className="season-xp-source">
          PvP 获胜 <strong>+100 XP</strong>
        </span>
        <span className="season-xp-source">
          大逃杀获胜 <strong>+200 XP</strong>
        </span>
        <span className="season-xp-source">
          每日挑战 <strong>+30 XP</strong>
        </span>
        <span className="season-xp-source">
          悬赏答题 <strong>+15~80 XP</strong>
        </span>
        <span className="season-xp-source">
          藏宝通关 <strong>+25~120 XP</strong>
        </span>
      </div>
    </main>
  );
}
