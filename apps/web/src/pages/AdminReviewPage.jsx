import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPendingReviews, fetchRevokedReviews, performReview, revokeReview, fetchGames, fetchPosts } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const TABS = [
  { key: "overview", label: "概览", icon: "📊" },
  { key: "games", label: "游戏审核", icon: "🎮" },
  { key: "posts", label: "帖子审核", icon: "📝" },
  { key: "all_games", label: "全部游戏", icon: "🗺️" },
  { key: "all_posts", label: "全部帖子", icon: "📋" },
  { key: "revoked_games", label: "已撤销游戏", icon: "↩️" },
  { key: "revoked_posts", label: "已撤销帖子", icon: "↩️" }
];

export default function AdminReviewPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [pending, setPending] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [revoked, setRevoked] = useState({ games: [], posts: [] });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reason, setReason] = useState({});
  const [actionMsg, setActionMsg] = useState("");
  const [expandedItem, setExpandedItem] = useState(null);
  const [revokeReason, setRevokeReason] = useState({});
  const [showRevokeInput, setShowRevokeInput] = useState(null);
  const initialLoaded = useRef(false);

  const loadAll = useCallback((showLoading = false) => {
    if (showLoading) setStatus("loading");
    setError("");
    Promise.all([
      fetchPendingReviews(token).catch(() => ({ items: [] })),
      fetchGames({ status: "" }).catch(() => ({ items: [] })),
      fetchPosts({ status: "" }).catch(() => ({ items: [] })),
      fetchRevokedReviews(token).catch(() => ({ games: [], posts: [] }))
    ])
      .then(([reviews, games, posts, revokedData]) => {
        setPending(reviews.items || []);
        setAllGames(games.items || []);
        setAllPosts(posts.items || []);
        setRevoked(revokedData || { games: [], posts: [] });
        setStatus("ready");
      })
      .catch((err) => { setError(err.message); setStatus("error"); });
  }, [token]);

  useEffect(() => {
    if (!initialLoaded.current) {
      initialLoaded.current = true;
      loadAll(true);
    }
  }, [loadAll]);

  async function handleReview(targetType, targetId, action) {
    const key = `${targetType}_${targetId}`;
    const reasonText = (reason[key] || "").trim();

    if (action === "reject" && !reasonText) {
      setError("拒绝通过必须注明原因，不能为空");
      return;
    }

    setError("");
    setActionMsg("");
    try {
      await performReview({ targetType, targetId, action, reason: reasonText }, token);
      setActionMsg(`已${action === "approve" ? "通过" : "拒绝"}：「${pending.find((p) => p.targetId === targetId)?.title || targetId}」`);
      setReason((prev) => ({ ...prev, [key]: "" }));
      setExpandedItem(null);
      loadAll(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevoke(targetType, targetId) {
    const key = `${targetType}_${targetId}`;
    const reasonText = (revokeReason[key] || "").trim();

    if (!reasonText) {
      setError("撤销审核必须注明原因，不能为空");
      return;
    }

    setError("");
    setActionMsg("");
    try {
      await revokeReview({ targetType, targetId, reason: reasonText }, token);
      setActionMsg(`已撤销审核，目标重新进入待审队列`);
      setRevokeReason((prev) => ({ ...prev, [key]: "" }));
      setShowRevokeInput(null);
      loadAll(false);
    } catch (err) {
      setError(err.message);
    }
  }

  if (user?.role !== "admin") {
    return (
      <main className="page-shell">
        <div className="card admin-denied">
          <span className="admin-denied-icon">🔒</span>
          <p className="hero-kicker">Access Denied</p>
          <h2>仅管理员可访问</h2>
          <p className="hero-copy">此管理后台仅对管理员角色开放。如需权限，请联系系统管理员。</p>
          <button className="primary-btn" onClick={() => navigate("/")}>返回前台</button>
        </div>
      </main>
    );
  }

  if (status === "loading") return <main className="admin-shell"><div className="admin-loading"><span className="admin-loading-spinner" /><p>加载管理后台...</p></div></main>;
  if (status === "error") return <main className="admin-shell"><div className="admin-loading"><span>⚠️</span><p>加载失败：{error}</p><button className="primary-btn" onClick={loadAll}>重试</button></div></main>;

  const pendingGames = pending.filter((p) => p.targetType === "game");
  const pendingPosts = pending.filter((p) => p.targetType === "community_post");

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-brand-icon">⚙️</span>
          <div>
            <strong>管理后台</strong>
            <span>GeoGuessrEX</span>
          </div>
        </div>

        <nav className="admin-nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-nav-item ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span className="admin-nav-icon">{t.icon}</span>
              <span className="admin-nav-label">{t.label}</span>
              {(t.key === "games" && pendingGames.length > 0) || (t.key === "posts" && pendingPosts.length > 0)
                ? <span className="admin-nav-badge">{t.key === "games" ? pendingGames.length : pendingPosts.length}</span>
                : (t.key === "revoked_games" && revoked.games.length > 0) || (t.key === "revoked_posts" && revoked.posts.length > 0)
                ? <span className="admin-nav-badge admin-nav-badge-muted">{t.key === "revoked_games" ? revoked.games.length : revoked.posts.length}</span>
                : null}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-sidebar-avatar">{user.username?.[0]?.toUpperCase() || "A"}</span>
            <div>
              <strong>{user.username}</strong>
              <span>管理员</span>
            </div>
          </div>
          <button className="secondary-btn admin-back-btn" onClick={() => navigate("/")}>← 返回前台</button>
        </div>
      </aside>

      <section className="admin-main">
        {actionMsg ? <div className="admin-toast" onClick={() => setActionMsg("")}>{actionMsg}</div> : null}
        {error ? <div className="admin-toast admin-toast-error" onClick={() => setError("")}>{error}</div> : null}

        {tab === "overview" && <OverviewTab pendingGames={pendingGames} pendingPosts={pendingPosts} allGames={allGames} allPosts={allPosts} onTabChange={setTab} />}

        {tab === "games" && (
          <ReviewTab title="游戏审核" icon="🎮" items={pendingGames} emptyText="暂无待审核游戏，好评！"
            reason={reason} setReason={setReason} onReview={handleReview}
            expandedItem={expandedItem} setExpandedItem={setExpandedItem}
            itemType="game"
          />
        )}

        {tab === "posts" && (
          <ReviewTab title="帖子审核" icon="📝" items={pendingPosts} emptyText="暂无待审核帖子，好评！"
            reason={reason} setReason={setReason} onReview={handleReview}
            expandedItem={expandedItem} setExpandedItem={setExpandedItem}
            itemType="post"
          />
        )}

        {tab === "all_games" && (
          <AllGamesTab games={allGames} revokeReason={revokeReason} setRevokeReason={setRevokeReason}
            showRevokeInput={showRevokeInput} setShowRevokeInput={setShowRevokeInput}
            onRevoke={handleRevoke} />
        )}
        {tab === "all_posts" && (
          <AllPostsTab posts={allPosts} revokeReason={revokeReason} setRevokeReason={setRevokeReason}
            showRevokeInput={showRevokeInput} setShowRevokeInput={setShowRevokeInput}
            onRevoke={handleRevoke} />
        )}
        {tab === "revoked_games" && <RevokedTab title="已撤销游戏" icon="↩️" items={revoked.games} type="game" />}
        {tab === "revoked_posts" && <RevokedTab title="已撤销帖子" icon="↩️" items={revoked.posts} type="post" />}
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════
// 概览
// ═══════════════════════════════════════════

function OverviewTab({ pendingGames, pendingPosts, allGames, allPosts, onTabChange }) {
  const approvedGames = allGames.filter((g) => g.status === "approved" || g.status === "active" || g.status === "completed");
  const rejectedGames = allGames.filter((g) => g.status === "rejected");
  const approvedPosts = allPosts.filter((p) => p.status === "approved");
  const rejectedPosts = allPosts.filter((p) => p.status === "rejected");

  const statGroups = [
    {
      label: "游戏",
      items: [
        { label: "待审核", value: pendingGames.length, color: "var(--accent-dark)", onClick: () => onTabChange("games") },
        { label: "已通过", value: approvedGames.length, color: "var(--green)" },
        { label: "已拒绝", value: rejectedGames.length, color: "var(--muted)" },
        { label: "总计", value: allGames.length, color: "var(--ink)" }
      ]
    },
    {
      label: "帖子",
      items: [
        { label: "待审核", value: pendingPosts.length, color: "var(--accent-dark)", onClick: () => onTabChange("posts") },
        { label: "已通过", value: approvedPosts.length, color: "var(--green)" },
        { label: "已拒绝", value: rejectedPosts.length, color: "var(--muted)" },
        { label: "总计", value: allPosts.length, color: "var(--ink)" }
      ]
    }
  ];

  return (
    <div className="admin-overview">
      <div className="admin-overview-head">
        <h2>📊 管理概览</h2>
        <span className="admin-overview-date">{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</span>
      </div>

      {statGroups.map((group) => (
        <div key={group.label} className="admin-overview-group">
          <h3 className="admin-overview-group-title">{group.label}</h3>
          <div className="admin-stat-cards">
            {group.items.map((s) => (
              <div
                key={s.label}
                className={`card admin-stat-card ${s.onClick ? "admin-stat-card-clickable" : ""}`}
                onClick={s.onClick}
              >
                <strong className="admin-stat-value" style={{ color: s.color }}>{s.value}</strong>
                <span className="admin-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 速览 */}
      {(pendingGames.length > 0 || pendingPosts.length > 0) ? (
        <div className="admin-overview-group">
          <h3 className="admin-overview-group-title">待办速览</h3>
          <div className="admin-quick-grid">
            {pendingGames.slice(0, 4).map((item) => (
              <div key={`g-${item.targetId}`} className="card admin-quick-card" onClick={() => onTabChange("games")}>
                <span className="admin-quick-type">🎮 游戏</span>
                <strong>{item.title}</strong>
                <span className="admin-quick-author">{item.creatorUsername}</span>
              </div>
            ))}
            {pendingPosts.slice(0, 4).map((item) => (
              <div key={`p-${item.targetId}`} className="card admin-quick-card" onClick={() => onTabChange("posts")}>
                <span className="admin-quick-type">📝 帖子</span>
                <strong>{item.title}</strong>
                <span className="admin-quick-author">{item.authorUsername}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card admin-all-clear">
          <span className="admin-all-clear-icon">🎉</span>
          <strong>全部审核完毕</strong>
          <p>没有待审核的游戏或帖子，辛苦了！</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 审核列表
// ═══════════════════════════════════════════

const CAT_LABELS = { lost_item: "寻物", found_item: "失物招领", missing_person: "寻人", announcement: "通告", other: "其他" };

function ReviewTab({ title, icon, items, emptyText, reason, setReason, onReview, expandedItem, setExpandedItem, itemType }) {
  if (!items.length) {
    return (
      <div className="admin-page">
        <div className="admin-page-head">
          <h2>{icon} {title}</h2>
        </div>
        <div className="card admin-empty-state">
          <span className="admin-empty-icon">✅</span>
          <strong>{emptyText}</strong>
          <p>所有{itemType === "game" ? "游戏" : "帖子"}已处理完毕。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>{icon} {title}</h2>
        <span className="admin-count">{items.length} 项待处理</span>
      </div>

      <div className="admin-review-grid">
        {items.map((item) => {
          const key = `${item.targetType}_${item.targetId}`;
          const isExpanded = expandedItem === key;

          return (
            <div key={key} className={`card admin-review-card ${isExpanded ? "expanded" : ""}`}>
              <div className="admin-review-card-top" onClick={() => setExpandedItem(isExpanded ? null : key)}>
                <div className="admin-review-card-head">
                  <span className="admin-review-type-badge">
                    {itemType === "game" ? "🎮 游戏" : "📝 帖子"}
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <div className="admin-review-card-meta">
                  <span>👤 {item.creatorUsername || item.authorUsername}</span>
                  <span>🕐 {new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                  {item.gameType ? <span className="badge badge-type">{item.gameType === "treasure_hunt" ? "藏宝" : "推理"}</span> : null}
                  {item.category ? <span className="badge badge-type">{CAT_LABELS[item.category] || item.category}</span> : null}
                </div>
                <button type="button" className="admin-expand-toggle">
                  {isExpanded ? "收起 ▲" : "展开审核 ▼"}
                </button>
              </div>

              {isExpanded ? (
                <div className="admin-review-card-actions">
                  <div className="admin-review-divider" />
                  <label className="admin-review-reason-label">
                    <span>审核意见</span>
                    <textarea
                      rows={2}
                      placeholder="通过可直接提交；拒绝必须填写原因"
                      value={reason[key] || ""}
                      onChange={(e) => setReason((prev) => ({ ...prev, [key]: e.target.value }))}
                      className={!reason[key]?.trim() ? "admin-reason-required" : ""}
                    />
                  </label>
                  <div className="admin-review-btns">
                    <button className="primary-btn admin-btn-approve" onClick={() => onReview(item.targetType, item.targetId, "approve")}>
                      ✓ 通过
                    </button>
                    <button className="secondary-btn danger-btn admin-btn-reject" onClick={() => onReview(item.targetType, item.targetId, "reject")}>
                      ✕ 拒绝
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 全部游戏
// ═══════════════════════════════════════════

const STATUS_LABELS = {
  pending_review: "审核中", approved: "已批准", rejected: "已拒绝", active: "进行中", completed: "已完成"
};

function AllGamesTab({ games, revokeReason, setRevokeReason, showRevokeInput, setShowRevokeInput, onRevoke }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return games;
    return games.filter((g) => g.status === filter);
  }, [games, filter]);

  const statusCounts = useMemo(() => {
    const counts = {};
    games.forEach((g) => { counts[g.status] = (counts[g.status] || 0) + 1; });
    return counts;
  }, [games]);

  const canRevoke = (status) => status !== "pending_review";

  if (!games.length) {
    return (
      <div className="admin-page">
        <div className="admin-page-head"><h2>🗺️ 全部游戏</h2></div>
        <div className="card admin-empty-state"><span className="admin-empty-icon">📭</span><strong>暂无游戏</strong></div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>🗺️ 全部游戏</h2>
        <span className="admin-count">{games.length} 个</span>
      </div>

      <div className="admin-filter-row">
        {[{ value: "", label: `全部 (${games.length})` },
          { value: "pending_review", label: `审核中 (${statusCounts.pending_review || 0})` },
          { value: "approved", label: `已批准 (${statusCounts.approved || 0})` },
          { value: "active", label: `进行中 (${statusCounts.active || 0})` },
          { value: "completed", label: `已完成 (${statusCounts.completed || 0})` },
          { value: "rejected", label: `已拒绝 (${statusCounts.rejected || 0})` }
        ].map((f) => (
          <button key={f.value} className={`filter-tab ${filter === f.value ? "active" : ""}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>状态</th>
              <th>发布者</th>
              <th>时间</th>
              <th style={{ width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((game) => {
              const key = `game_${game.id}`;
              const isRevoking = showRevokeInput === key;
              return (
                <tr key={game.id} className="admin-table-row">
                  <td className="admin-table-title">{game.title}</td>
                  <td>{game.gameType === "treasure_hunt" ? "🗺️ 藏宝" : "🧩 推理"}</td>
                  <td><span className={`badge badge-${game.status}`}>{STATUS_LABELS[game.status] || game.status}</span></td>
                  <td>{game.creatorUsername}</td>
                  <td className="admin-table-date">{new Date(game.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td>
                    {canRevoke(game.status) ? (
                      isRevoking ? (
                        <div className="admin-revoke-inline">
                          <input
                            type="text"
                            placeholder="撤销原因（必填）"
                            value={revokeReason[key] || ""}
                            onChange={(e) => setRevokeReason((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="admin-revoke-input"
                            autoFocus
                          />
                          <div className="admin-revoke-btns">
                            <button className="primary-btn admin-btn-approve" style={{ padding: "6px 12px", fontSize: "0.8rem", minWidth: 0 }}
                              onClick={() => onRevoke("game", game.id)}>确认</button>
                            <button className="secondary-btn" style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                              onClick={() => { setShowRevokeInput(null); setRevokeReason((prev) => ({ ...prev, [key]: "" })); }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <button className="admin-revoke-btn"
                          onClick={() => setShowRevokeInput(key)}>↩ 撤销</button>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="admin-table-empty">没有匹配的记录</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 全部帖子
// ═══════════════════════════════════════════

function AllPostsTab({ posts, revokeReason, setRevokeReason, showRevokeInput, setShowRevokeInput, onRevoke }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return posts;
    return posts.filter((p) => p.status === filter || p.category === filter);
  }, [posts, filter]);

  const statusCounts = useMemo(() => {
    const counts = {};
    posts.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [posts]);

  const canRevoke = (status) => status !== "pending_review";

  if (!posts.length) {
    return (
      <div className="admin-page">
        <div className="admin-page-head"><h2>📋 全部帖子</h2></div>
        <div className="card admin-empty-state"><span className="admin-empty-icon">📭</span><strong>暂无帖子</strong></div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>📋 全部帖子</h2>
        <span className="admin-count">{posts.length} 篇</span>
      </div>

      <div className="admin-filter-row">
        {[{ value: "", label: `全部 (${posts.length})` },
          { value: "pending_review", label: `审核中 (${statusCounts.pending_review || 0})` },
          { value: "approved", label: `已批准 (${statusCounts.approved || 0})` },
          { value: "rejected", label: `已拒绝 (${statusCounts.rejected || 0})` }
        ].map((f) => (
          <button key={f.value} className={`filter-tab ${filter === f.value ? "active" : ""}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>分类</th>
              <th>状态</th>
              <th>作者</th>
              <th>时间</th>
              <th style={{ width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post) => {
              const key = `community_post_${post.id}`;
              const isRevoking = showRevokeInput === key;
              return (
                <tr key={post.id} className="admin-table-row">
                  <td className="admin-table-title">{post.title}</td>
                  <td>{CAT_LABELS[post.category] || post.category}</td>
                  <td><span className={`badge badge-${post.status}`}>{STATUS_LABELS[post.status] || post.status}</span></td>
                  <td>{post.authorUsername}</td>
                  <td className="admin-table-date">{new Date(post.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td>
                    {canRevoke(post.status) ? (
                      isRevoking ? (
                        <div className="admin-revoke-inline">
                          <input
                            type="text"
                            placeholder="撤销原因（必填）"
                            value={revokeReason[key] || ""}
                            onChange={(e) => setRevokeReason((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="admin-revoke-input"
                            autoFocus
                          />
                          <div className="admin-revoke-btns">
                            <button className="primary-btn admin-btn-approve" style={{ padding: "6px 12px", fontSize: "0.8rem", minWidth: 0 }}
                              onClick={() => onRevoke("community_post", post.id)}>确认</button>
                            <button className="secondary-btn" style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                              onClick={() => { setShowRevokeInput(null); setRevokeReason((prev) => ({ ...prev, [key]: "" })); }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <button className="admin-revoke-btn"
                          onClick={() => setShowRevokeInput(key)}>↩ 撤销</button>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="admin-table-empty">没有匹配的记录</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 已撤销列表
// ═══════════════════════════════════════════

const REVOKED_CAT_LABELS = { lost_item: "寻物", found_item: "失物招领", missing_person: "寻人", announcement: "通告", other: "其他" };
const REVOKED_CAT_ICONS = { lost_item: "🔍", found_item: "📦", missing_person: "🚨", announcement: "📢", other: "💬" };

function RevokedTab({ title, icon, items, type }) {
  const [detailItem, setDetailItem] = useState(null);

  if (!items.length) {
    return (
      <div className="admin-page">
        <div className="admin-page-head"><h2>{icon} {title}</h2></div>
        <div className="card admin-empty-state">
          <span className="admin-empty-icon">✅</span>
          <strong>暂无撤销记录</strong>
          <p>被撤销审核的{type === "game" ? "游戏" : "帖子"}会出现在这里。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>{icon} {title}</h2>
        <span className="admin-count">{items.length} 条</span>
      </div>

      <div className="admin-revoked-grid">
        {items.map((item) => (
          <div key={item.reviewId} className="card admin-revoked-card" onClick={() => setDetailItem(item)}>
            <div className="admin-revoked-head">
              <h3>{item.title}</h3>
              {type === "game" ? (
                <span className="badge badge-type">{item.gameType === "treasure_hunt" ? "🗺️ 藏宝" : "🧩 推理"}</span>
              ) : (
                <span className="badge badge-type">{REVOKED_CAT_ICONS[item.category] || "📝"} {REVOKED_CAT_LABELS[item.category] || item.category}</span>
              )}
            </div>
            <div className="admin-revoked-meta">
              <span>👤 {item.creatorUsername || item.authorUsername}</span>
              {item.region ? <span>📍 {item.region}</span> : null}
              <span>🕐 撤销于 {new Date(item.revokedAt).toLocaleString("zh-CN")}</span>
            </div>
            <div className="admin-revoked-reason">
              <span className="admin-revoked-reason-label">撤销原因</span>
              <p>{item.reason}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 详情弹窗 */}
      {detailItem ? (
        <div className="admin-modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{type === "game" ? "🎮" : "📝"} {detailItem.title}</h2>
              <button className="admin-modal-close" onClick={() => setDetailItem(null)}>✕</button>
            </div>

            <div className="admin-modal-body">
              {type === "game" ? (
                <>
                  <div className="admin-modal-meta">
                    <span className="badge badge-type">{detailItem.gameType === "treasure_hunt" ? "🗺️ 藏宝" : "🧩 推理"}</span>
                    {detailItem.region ? <span>📍 {detailItem.region}</span> : null}
                    <span>👤 {detailItem.creatorUsername}</span>
                    <span>📅 {detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleString("zh-CN") : "-"}</span>
                  </div>

                  {detailItem.description ? (
                    <div className="admin-modal-section">
                      <strong>游戏描述</strong>
                      <p>{detailItem.description}</p>
                    </div>
                  ) : null}

                  {detailItem.locationTasks?.length > 0 ? (
                    <div className="admin-modal-section">
                      <strong>地点流程 ({detailItem.locationTasks.length} 步)</strong>
                      <div className="flow-steps">
                        {detailItem.locationTasks.map((task, i) => (
                          <div key={task.id || i} className="flow-step">
                            <div className="flow-step-num">{i + 1}</div>
                            <div>
                              <strong>{task.title}</strong>
                              {task.description ? <p>{task.description}</p> : null}
                              <p className="hint-text">📍 ({task.targetLat}, {task.targetLng}) · {task.taskType === "gps_check" ? "GPS校验" : "拍照上传"}</p>
                              {task.arrivalHint ? <p className="hint-text">💡 {task.arrivalHint}</p> : null}
                              {task.nextLocationHint ? <p className="hint-text">🧭 {task.nextLocationHint}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="admin-modal-meta">
                    <span className="badge badge-type">{REVOKED_CAT_ICONS[detailItem.category] || "📝"} {REVOKED_CAT_LABELS[detailItem.category] || detailItem.category}</span>
                    {detailItem.region ? <span>📍 {detailItem.region}</span> : null}
                    <span>👤 {detailItem.authorUsername}</span>
                    <span>📅 {detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleString("zh-CN") : "-"}</span>
                  </div>

                  {detailItem.content ? (
                    <div className="admin-modal-section">
                      <strong>帖子内容</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{detailItem.content}</p>
                    </div>
                  ) : null}

                  {detailItem.contactInfo ? (
                    <div className="admin-modal-section">
                      <strong>联系方式</strong>
                      <p>{detailItem.contactInfo}</p>
                    </div>
                  ) : null}

                  {detailItem.mediaList?.length > 0 ? (
                    <div className="admin-modal-section">
                      <strong>媒体素材 ({detailItem.mediaList.length} 个)</strong>
                      <div className="revoked-media-grid">
                        {detailItem.mediaList.map((m, i) => (
                          <div key={i} className="revoked-media-item">
                            {m.type === "image"
                              ? <img src={`http://localhost:3001${m.url}`} alt={m.name || ""} />
                              : <video src={`http://localhost:3001${m.url}`} controls preload="metadata" />}
                            <span>{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              <div className="admin-modal-section admin-modal-reason">
                <strong>撤销原因</strong>
                <p>{detailItem.reason}</p>
                <span className="admin-modal-reason-time">撤销于 {new Date(detailItem.revokedAt).toLocaleString("zh-CN")}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
