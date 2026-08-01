import { useEffect, useState } from "react";
import CharacterPortrait from "./CharacterPortrait.jsx";

const API = "http://localhost:3001/api";

/**
 * 角色选择界面
 * onSelect: 选定角色后的回调
 * token: 认证token
 * selectedId: 当前已选角色ID
 */
export default function CharacterSelect({ onSelect, token, selectedId: initialId, mode = "full" }) {
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState(initialId || "explorer");
  const [loading, setLoading] = useState(true);
  const [entranceDone, setEntranceDone] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    fetch(`${API}/characters`)
      .then(r => r.json())
      .then(data => {
        setCharacters(data.items || []);
        setLoading(false);
        // 依次播放入场动画
        setTimeout(() => setEntranceDone(true), data.items?.length * 180 + 400);
      })
      .catch(() => setLoading(false));

    if (token) {
      fetch(`${API}/user/character`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.characterId) setSelectedId(d.characterId); })
        .catch(() => {});
    }
  }, [token]);

  const selectedChar = characters.find(c => c.id === selectedId);
  const hoveredChar = characters.find(c => c.id === hoveredId);
  const displayChar = hoveredChar || selectedChar;

  function handleSelect(charId) {
    setSelectedId(charId);
    // 保存到后端
    if (token) {
      fetch(`${API}/user/character`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ characterId: charId })
      }).catch(() => {});
    }
  }

  if (loading) {
    return <div className="char-select-loading">🌀 加载角色中...</div>;
  }

  return (
    <div className={`char-select-shell char-select-${mode}`}>
      {/* 左侧大立绘展示区 */}
      <div className="char-select-showcase">
        <div className="char-select-stage">
          {displayChar && (
            <CharacterPortrait
              key={displayChar.id}
              character={displayChar}
              mode="full"
              animated
              size={280}
            />
          )}
        </div>
        {/* 被动/主动技能详情 */}
        {displayChar && (
          <div className="char-select-abilities">
            <div className="char-ability char-passive">
              <span className="ability-icon">{displayChar.passive.icon}</span>
              <div>
                <strong className="ability-label">被动 · {displayChar.passive.name}</strong>
                <p className="ability-desc">{displayChar.passive.description}</p>
              </div>
            </div>
            <div className="char-ability char-active-skill">
              <span className="ability-icon">{displayChar.active.icon}</span>
              <div>
                <strong className="ability-label">主动 · {displayChar.active.name}</strong>
                <p className="ability-desc">{displayChar.active.description}</p>
                <span className="ability-uses">
                  {displayChar.active.usesPerGame > 0 ? `每局可用 ${displayChar.active.usesPerGame} 次` : "被动无冷却"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右侧角色列表 */}
      <div className="char-select-grid">
        <h2 className="char-select-title">选择你的角色</h2>
        <div className="char-grid">
          {characters.map((char, index) => (
            <button
              key={char.id}
              className={`char-card ${selectedId === char.id ? "selected" : ""} ${!entranceDone ? "char-card-entering" : ""}`}
              style={{ animationDelay: `${index * 0.12}s` }}
              onClick={() => handleSelect(char.id)}
              onMouseEnter={() => setHoveredId(char.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="char-card-visual" style={{ background: char.bgGradient }}>
                <span className="char-card-emoji">{char.emoji}</span>
                <div className="char-card-rarity">
                  {char.rarity === "epic" ? "✨" : char.rarity === "rare" ? "💎" : ""}
                </div>
              </div>
              <div className="char-card-info">
                <strong>{char.name}</strong>
                <span>{char.nameEn}</span>
              </div>
              {selectedId === char.id && <div className="char-card-check">✓</div>}
            </button>
          ))}
        </div>
        <button
          className="primary-btn char-confirm-btn"
          onClick={() => onSelect?.(selectedId, displayChar)}
        >
          确认选择 · {displayChar?.name || ""}
        </button>
      </div>
    </div>
  );
}
