import { useEffect, useMemo, useState } from "react";
import AmapGuessMap from "../components/AmapGuessMap.jsx";
import StreetViewPanel from "../components/StreetViewPanel.jsx";
import AmapResultMap from "../components/AmapResultMap.jsx";
import ResultPanel from "../components/ResultPanel.jsx";
import { fetchQuestions, submitAnswer } from "../services/api.js";

export default function GamePage() {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const amapApiKey = import.meta.env.VITE_AMAP_API_KEY || "";
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("landing");
  const [mapExpanded, setMapExpanded] = useState(true);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchQuestions()
      .then((data) => {
        setQuestions(data.items);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  const question = useMemo(
    () => questions[questionIndex] ?? null,
    [questions, questionIndex]
  );

  async function handleSubmit() {
    if (!question || !guess) {
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      const response = await submitAnswer({
        questionId: question.id,
        guess
      });
      setResult(response);
      setStatus("result");
    } catch (err) {
      setError(err.message);
      setStatus("ready");
    }
  }

  function handleNext() {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= questions.length) {
      setQuestionIndex(0);
    } else {
      setQuestionIndex(nextIndex);
    }

    setGuess(null);
    setResult(null);
    setMapExpanded(true);
    setStatus("ready");
  }

  if (status === "loading") {
    return <div className="status-shell">Loading question bank...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">Failed: {error}</div>;
  }

  if (!question) {
    return <div className="status-shell">No questions found.</div>;
  }

  const isLast = questionIndex === questions.length - 1;

  function handleStart() {
    setPhase("playing");
  }

  return (
    <>
      {phase === "landing" ? (
        <main className="landing-shell">
          <section className="landing-panel">
            <p className="hero-kicker">Geo Search MVP</p>
            <h1>Drop into the street. Find the place.</h1>
            <p className="hero-copy">
              Start from a full-screen Street View round, place your pin on the minimap,
              then submit to compare distance and score.
            </p>
            <button className="primary-btn landing-btn" onClick={handleStart}>
              Start Game
            </button>
          </section>
        </main>
      ) : !result ? (
        <main className="play-shell">
          <StreetViewPanel question={question} apiKey={googleMapsApiKey} fullscreen />
          <div className="streetview-vignette" />
          <div className="hud-top">
            <div className="hud-chip">
              <span>Round</span>
              <strong>
                {questionIndex + 1} / {questions.length}
              </strong>
            </div>
            <div className="hud-chip">
              <span>Title</span>
              <strong>{question.title}</strong>
            </div>
            <div className="hud-chip hud-chip-accent">
              <span>Status</span>
              <strong>{guess ? "Pin placed" : "Choose a location"}</strong>
            </div>
          </div>

          <div className="hud-bottom">
            <section className={`mini-map-dock ${mapExpanded ? "expanded" : "collapsed"}`}>
              <button
                className="dock-toggle"
                type="button"
                onClick={() => setMapExpanded((current) => !current)}
              >
                <span>{mapExpanded ? "Collapse map" : "Open map"}</span>
                <strong>{mapExpanded ? "−" : "+"}</strong>
              </button>
              {mapExpanded ? (
                <div className="mini-map-wrap">
                  <AmapGuessMap value={guess} onChange={setGuess} apiKey={amapApiKey} />
                </div>
              ) : null}
            </section>
            <section className="card floating-controls">
              <div className="eyebrow">Guess</div>
              <p>
                Selected point:{" "}
                <strong>{guess ? `${guess.lat}, ${guess.lng}` : "No guess yet"}</strong>
              </p>
              <button
                className="primary-btn"
                onClick={handleSubmit}
                disabled={!guess || status === "submitting"}
              >
                {status === "submitting" ? "Submitting..." : "Submit Guess"}
              </button>
              {error ? <p className="error-text">{error}</p> : null}
            </section>
          </div>
        </main>
      ) : (
        <main className="play-shell result-overlay-shell">
          <StreetViewPanel question={question} apiKey={googleMapsApiKey} fullscreen />
          <div className="streetview-vignette result-vignette" />
          <section className="result-overlay-card">
            <div className="result-overlay-grid">
              <AmapResultMap result={result} apiKey={amapApiKey} />
              <ResultPanel result={result} onNext={handleNext} isLast={isLast} />
            </div>
          </section>
        </main>
      )}
    </>
  );
}
