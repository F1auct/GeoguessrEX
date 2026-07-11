import { useState } from "react";

/**
 * 卡牌展示组件
 * card: 卡牌数据对象
 * used: 是否已使用
 * onUse: 使用回调
 * mini: 小尺寸模式
 * flipped: 是否翻转展示
 */
export default function CardDisplay({ card, used = false, onUse, mini = false, flipped: initFlipped = false }) {
  const [flipped, setFlipped] = useState(initFlipped);
  const [flipping, setFlipping] = useState(false);

  if (!card) {
    return mini ? null : (
      <div className="card-display card-empty">
        <span>🃏</span>
        <p>暂无卡牌</p>
      </div>
    );
  }

  function handleFlip() {
    if (flipping) return;
    setFlipping(true);
    setFlipped(!flipped);
    setTimeout(() => setFlipping(false), 600);
  }

  const rarityLabel = {
    common: "普通", rare: "稀有", epic: "史诗", legendary: "传说"
  };

  if (mini) {
    return (
      <button
        className={`card-mini card-rarity-${card.rarity} ${used ? "card-used" : ""}`}
        onClick={onUse && !used ? onUse : undefined}
        title={card.description}
        disabled={used}
      >
        <span className="card-mini-emoji">{card.emoji}</span>
        <span className="card-mini-name">{card.name}</span>
        {used && <span className="card-mini-used">已用</span>}
      </button>
    );
  }

  return (
    <div className={`card-display card-rarity-${card.rarity} ${used ? "card-used" : ""} ${flipped ? "card-flipped" : ""}`}>
      <div className="card-inner" onClick={handleFlip}>
        {/* 正面 */}
        <div className="card-front" style={{ borderColor: card.color }}>
          <div className="card-front-header" style={{ background: card.color }}>
            <span className="card-rarity-badge">{rarityLabel[card.rarity]}</span>
            <span className="card-emoji-large">{card.emoji}</span>
          </div>
          <div className="card-front-body">
            <strong className="card-name">{card.name}</strong>
            <p className="card-flavor">"{card.flavor}"</p>
            <p className="card-desc">{card.description}</p>
          </div>
          {!used && onUse && (
            <button className="card-use-btn" onClick={(e) => { e.stopPropagation(); onUse(); }}>
              使用卡牌
            </button>
          )}
          {used && <div className="card-used-stamp">已使用</div>}
          <div className="card-click-hint">点击翻转</div>
        </div>

        {/* 背面 */}
        <div className="card-back" style={{ borderColor: card.color }}>
          <div className="card-back-pattern" style={{ background: `repeating-linear-gradient(45deg, ${card.color}22, ${card.color}22 10px, ${card.color}11 10px, ${card.color}11 20px)` }}>
            <span className="card-back-icon">🃏</span>
            <span className="card-back-text">GeoGuessrEX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
