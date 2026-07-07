export default function ResultPanel({ result, onNext, isLast }) {
  return (
    <section className="card result-card">
      <div className="eyebrow">Round Result</div>
      <h2>{result.title}</h2>
      <p className="result-summary">
        Your marker and the target are plotted on the route board. Use the next round to recalibrate.
      </p>
      <div className="stats-grid">
        <div>
          <span>Distance</span>
          <strong>{result.distanceKm.toFixed(2)} km</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>{result.score}</strong>
        </div>
        <div>
          <span>Guess</span>
          <strong>
            {result.guess.lat}, {result.guess.lng}
          </strong>
        </div>
        <div>
          <span>Answer</span>
          <strong>
            {result.answer.lat}, {result.answer.lng}
          </strong>
        </div>
      </div>
      <button className="primary-btn" onClick={onNext}>
        {isLast ? "Restart" : "Next Question"}
      </button>
    </section>
  );
}
