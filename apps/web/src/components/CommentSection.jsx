import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = "http://localhost:3001/api";

export default function CommentSection({ targetType, targetId }) {
  const { token, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [likes, setLikes] = useState({ count: 0, liked: false });

  useEffect(() => {
    fetch(`${API_BASE}/comments/${targetType}/${targetId}`).then(r => r.json()).then(d => setComments(d.items || [])).catch(() => {});
    if (token) fetch(`${API_BASE}/likes/${targetType}/${targetId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setLikes).catch(() => {});
  }, [targetType, targetId, token]);

  async function handleLike() {
    if (!user) return;
    const res = await fetch(`${API_BASE}/likes`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetType, targetId })
    });
    const data = await res.json();
    setLikes(data);
  }

  async function handleComment(parentId = null) {
    if (!user) return;
    const content = parentId ? replyText : text;
    if (!content.trim()) return;
    await fetch(`${API_BASE}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetType, targetId, content, parentId })
    });
    if (parentId) { setReplyTo(null); setReplyText(""); } else setText("");
    const r = await fetch(`${API_BASE}/comments/${targetType}/${targetId}`);
    setComments((await r.json()).items || []);
  }

  return (
    <div className="comment-section">
      <div className="comment-like-row">
        <button className={`comment-like-btn ${likes.liked ? "liked" : ""}`} onClick={handleLike}>
          {likes.liked ? "❤️" : "🤍"} <span>{likes.count}</span>
        </button>
      </div>

      {user ? (
        <div className="comment-input-row">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="写评论..." onKeyDown={e => e.key === "Enter" && handleComment()} />
          <button className="primary-btn" onClick={() => handleComment()} disabled={!text.trim()}>发送</button>
        </div>
      ) : null}

      {comments.map(c => (
        <div key={c.id} className="comment-item">
          <div className="comment-head">
            <span className="comment-avatar">{c.username?.[0]?.toUpperCase()}</span>
            <strong>{c.username}</strong>
            <span className="comment-time">{new Date(c.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <p>{c.content}</p>
          {user ? <button className="comment-reply-btn" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>回复</button> : null}

          {replyTo === c.id ? (
            <div className="comment-reply-row">
              <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="回复..." onKeyDown={e => e.key === "Enter" && handleComment(c.id)} />
              <button className="primary-btn" onClick={() => handleComment(c.id)} disabled={!replyText.trim()}>回复</button>
            </div>
          ) : null}

          {c.replies?.map(r => (
            <div key={r.id} className="comment-item comment-reply">
              <div className="comment-head">
                <span className="comment-avatar">{r.username?.[0]?.toUpperCase()}</span>
                <strong>{r.username}</strong>
                <span className="comment-time">{new Date(r.createdAt).toLocaleString("zh-CN")}</span>
              </div>
              <p>{r.content}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
