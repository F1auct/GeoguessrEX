import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

const TIER_LABELS = {
  bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum",
  diamond: "Diamond", master: "Master", grandmaster: "Grandmaster",
};

const TIER_COLORS = {
  bronze: "#8B6914", silver: "#8C92AC", gold: "#D4A017", platinum: "#4A90A4",
  diamond: "#7B68EE", master: "#FF6B6B", grandmaster: "#FFD700",
};

const TIER_BG = {
  bronze: "#8B6914", silver: "#8C92AC", gold: "#D4A017", platinum: "#4A90A4",
  diamond: "#7B68EE", master: "#FF6B6B", grandmaster: "#FFD700",
};

function StarBar({ stars, color }) {
  return (
    <div className="ranked-stars">
      {Array.from({ length: 5 }).map(function (_, i) {
        return (
          <span key={i} className={"ranked-star" + (i < stars ? " filled" : " empty")} style={i < stars ? { color: color || "#D4A017" } : {}}>
            ★
          </span>
        );
      })}
    </div>
  );
}

export default function RankedPage() {
  var _useAuth = useAuth();
  var token = _useAuth.token;
  var user = _useAuth.user;
  var navigate = useNavigate();

  var _useState = useState(null);
  var myRank = _useState[0];
  var setMyRank = _useState[1];

  var _useState2 = useState([]);
  var leaderboard = _useState2[0];
  var setLeaderboard = _useState2[1];

  var _useState3 = useState([]);
  var history = _useState3[0];
  var setHistory = _useState3[1];

  var _useState4 = useState(false);
  var inQueue = _useState4[0];
  var setInQueue = _useState4[1];

  var _useState5 = useState(0);
  var queueWait = _useState5[0];
  var setQueueWait = _useState5[1];

  var _useState6 = useState("loading");
  var status = _useState6[0];
  var setStatus = _useState6[1];

  var _useState7 = useState("");
  var error = _useState7[0];
  var setError = _useState7[1];

  var _useState8 = useState("overview");
  var tab = _useState8[0];
  var setTab = _useState8[1];

  var authHeaders = { Authorization: "Bearer " + token };

  var loadData = useCallback(async function () {
    try {
      var results = await Promise.all([
        fetch(API_BASE + "/ranked/me", { headers: authHeaders }),
        fetch(API_BASE + "/ranked/leaderboard"),
        fetch(API_BASE + "/ranked/history", { headers: authHeaders }),
      ]);
      var meRes = results[0];
      var lbRes = results[1];
      var histRes = results[2];

      if (meRes.ok) setMyRank(await meRes.json());
      if (lbRes.ok) {
        var lbData = await lbRes.json();
        setLeaderboard(lbData.items || []);
      }
      if (histRes.ok) {
        var histData = await histRes.json();
        setHistory(histData.items || []);
      }
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [token]);

  useEffect(function () { loadData(); }, [loadData]);

  // Matchmaking polling
  useEffect(function () {
    if (!inQueue) return;
    var cancelled = false;
    async function poll() {
      try {
        var res = await fetch(API_BASE + "/ranked/queue/status", { headers: authHeaders });
        var data = await res.json();
        if (cancelled) return;
        setQueueWait(data.waitedMs || 0);
        if (data.match) {
          setInQueue(false);
          var roomRes = await fetch(API_BASE + "/ranked/create-room", {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, authHeaders),
            body: JSON.stringify({ maxRounds: 5 }),
          });
          var room = await roomRes.json();
          navigate("/pvp?code=" + room.code + "&ranked=true&opponentId=" + data.match.opponentId);
        }
      } catch (e) {}
    }
    poll();
    var timer = setInterval(poll, 2000);
    return function () { cancelled = true; clearInterval(timer); };
  }, [inQueue, token, navigate]);

  async function handleJoinQueue() {
    var res = await fetch(API_BASE + "/ranked/queue/join", { method: "POST", headers: authHeaders });
    var data = await res.json();
    if (data.queued) setInQueue(true);
  }

  async function handleLeaveQueue() {
    await fetch(API_BASE + "/ranked/queue/leave", { method: "POST", headers: authHeaders });
    setInQueue(false);
  }

  if (status === "loading") {
    return (
      <main className="ranked-page">
        <div className="ranked-container">
          <div className="status-shell">Loading ranked data...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="ranked-page">
      <div className="ranked-container">
        <div className="ranked-header">
          <p className="hero-kicker">RANKED MATCH</p>
          <h1>排位赛</h1>
        </div>

        {/* My Rank Card */}
        {myRank && (
          <div className="ranked-my-card">
            <span className="ranked-tier-badge" style={{ background: (TIER_COLORS[myRank.rank_tier] || "#666") + "22", color: myRank.tierColor }}>
              {myRank.tierLabel}
            </span>
            <StarBar stars={myRank.rank_stars} color={myRank.tierColor} />
            <p className="ranked-meta">
              {myRank.rank_stars}/5 stars / Score {myRank.totalStars}
            </p>
            <div className="ranked-stats">
              <div className="ranked-stat wins">
                <span>W</span><strong>{myRank.weeklyWins}</strong>
              </div>
              <div className="ranked-stat losses">
                <span>L</span><strong>{myRank.weeklyLosses}</strong>
              </div>
              <div className="ranked-stat">
                <span>WR</span><strong>{myRank.weeklyWinRate}%</strong>
              </div>
            </div>

            {!inQueue ? (
              <button className="primary-btn ranked-queue-btn" onClick={handleJoinQueue}>
                Start Matchmaking
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="ranked-queue-spinner" />
                <p className="ranked-queue-text">Matching... {Math.floor(queueWait / 1000)}s</p>
                <p className="ranked-queue-hint">Searching for similar-ranked opponent</p>
                <button className="secondary-btn" onClick={handleLeaveQueue} style={{ marginTop: 8 }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="ranked-tabs">
          {["overview", "leaderboard", "history"].map(function (t) {
            var labels = { overview: "Overview", leaderboard: "Leaderboard", history: "History" };
            return (
              <button key={t} className={"ranked-tab" + (tab === t ? " active" : "")} onClick={function () { setTab(t); }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Leaderboard */}
        {tab === "leaderboard" && (
          <div className="ranked-lb-list">
            {leaderboard.map(function (p, i) {
              return (
                <div key={p.id} className={"ranked-lb-item" + (p.id === (user && user.id) ? " mine" : "")}>
                  <div className={"ranked-lb-rank" + (i < 3 ? " top" + (i + 1) : "")}>{i + 1}</div>
                  <div className="ranked-lb-tier" style={{ background: p.tierColor }}>{p.rank_stars}</div>
                  <div className="ranked-lb-user">
                    <strong>{p.username}</strong>
                    <span className="ranked-lb-tier-label" style={{ color: p.tierColor }}>{p.tierLabel}</span>
                  </div>
                  <div className="ranked-lb-stars">{p.rank_stars} Stars</div>
                </div>
              );
            })}
          </div>
        )}

        {/* History */}
        {tab === "history" && (
          <div className="ranked-history">
            {history.length === 0 ? (
              <div className="ranked-history-empty">No match history yet. Start your first ranked game!</div>
            ) : (
              history.map(function (m) {
                var iWon = m.winner_id === (user && user.id);
                return (
                  <div key={m.id} className="ranked-hist-item">
                    <div className={"ranked-hist-result " + (iWon ? "win" : "loss")}>
                      {iWon ? "W" : "L"}
                    </div>
                    <div className="ranked-hist-info">
                      <strong>{iWon ? "Victory" : "Defeat"}</strong>
                      <span className="ranked-hist-opponent">
                        vs {iWon ? m.loser_name : m.winner_name}
                      </span>
                    </div>
                    <div className={"ranked-hist-change " + (iWon ? "win" : "loss")}>
                      {iWon ? "+" + m.winner_stars_change + " Star" : m.loser_stars_change + " Star"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Overview */}
        {tab === "overview" && (
          <div className="ranked-overview">
            <h3>Rank Tiers</h3>
            <div className="ranked-tier-grid">
              {Object.entries(TIER_LABELS).map(function (entry, i) {
                var key = entry[0];
                var label = entry[1];
                var isCurrent = myRank && myRank.rank_tier === key;
                return (
                  <div
                    key={key}
                    className={"ranked-tier-card" + (isCurrent ? " current" : "")}
                    style={isCurrent ? { borderColor: myRank.tierColor } : {}}
                  >
                    <div className="ranked-tier-icon" style={{ background: TIER_BG[key] }}>{i + 1}</div>
                    <div className="ranked-tier-card-label" style={{ color: TIER_COLORS[key] }}>{label}</div>
                    <div className="ranked-tier-card-score">{i * 5} pts</div>
                  </div>
                );
              })}
            </div>
            <p className="ranked-rules">
              Win +1 Star / Full stars promote / Loss -1 Star / Bronze is safe
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
