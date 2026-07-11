import { useEffect, useState } from "react";

/**
 * 角色立绘组件
 * mode: "full" = 全身立绘, "chibi" = Q版, "icon" = 头像
 * animated: 是否播放入场动画
 * size: 尺寸控制
 */
export default function CharacterPortrait({ character, mode = "full", animated = false, size = 200, className = "" }) {
  const [show, setShow] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const t = setTimeout(() => setShow(true), 50);
      return () => clearTimeout(t);
    }
  }, [animated]);

  if (!character) return null;

  const chibiSize = Math.round(size * 0.55);

  if (mode === "chibi") {
    return (
      <div
        className={`char-portrait char-portrait-chibi char-${character.id} ${show ? "char-enter-done" : "char-enter"} ${className}`}
        style={{ width: chibiSize, height: chibiSize }}
        title={character.name}
      >
        <div className="char-chibi-body">
          <div className="char-chibi-face">
            <span className="char-chibi-emoji">{character.emoji}</span>
          </div>
          <div className="char-chibi-shadow" />
        </div>
        <span className="char-chibi-name">{character.name}</span>
      </div>
    );
  }

  if (mode === "icon") {
    return (
      <div className={`char-icon char-${character.id}`} title={character.name}
        style={{ width: size, height: size, fontSize: size * 0.45 }}>
        {character.emoji}
      </div>
    );
  }

  // full mode
  return (
    <div
      className={`char-portrait char-portrait-full char-${character.id} ${show ? "char-enter-done" : "char-enter"} ${className}`}
      style={{ "--char-color": character.color }}
    >
      <div className="char-full-frame">
        <div className="char-full-bg" style={{ background: character.bgGradient }} />
        <div className="char-full-emblem">{character.emoji}</div>
        <div className="char-full-silhouette">
          {/* CSS 绘制的简化角色剪影 */}
          <div className={`char-sil-${character.id}`} />
        </div>
        <div className="char-full-vignette" />
      </div>
      <div className="char-full-info">
        <strong className="char-full-name">{character.name}</strong>
        <span className="char-full-en">{character.nameEn}</span>
        <div className="char-full-tags">
          {character.tags?.map(tag => <span key={tag} className="char-tag">{tag}</span>)}
        </div>
      </div>
    </div>
  );
}
