export default function ResultPanel({ result, onNext, isLast }) {
  return (
    <section className="card result-card result-info-card">
      <div className="eyebrow">本题结果</div>
      <p className="result-summary">
        {result.groupTitle ? `题库组：${result.groupTitle}` : "已完成本题定位。"}
      </p>

      <div className="stats-grid">
        <div>
          <span>距离</span>
          <strong>{result.distanceKm.toFixed(2)} km</strong>
        </div>
        <div>
          <span>得分</span>
          <strong>{result.score}</strong>
        </div>
        <div>
          <span>你的猜测</span>
          <strong>
            {result.guess.lat}, {result.guess.lng}
          </strong>
        </div>
        <div>
          <span>正确位置</span>
          <strong>
            {result.answer.lat}, {result.answer.lng}
          </strong>
        </div>
      </div>

      <section className="result-description">
        <div className="eyebrow">地点介绍</div>
        <p>{result.description || "这个地点暂时还没有介绍。你可以在题库管理里补充描述。"}</p>
      </section>

      <button className="primary-btn" onClick={onNext}>
        {isLast ? "重新开始" : "下一题"}
      </button>
    </section>
  );
}
