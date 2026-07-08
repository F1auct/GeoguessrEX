import { useEffect, useMemo, useState } from "react";
import AmapGuessMap from "../components/AmapGuessMap.jsx";
import StreetViewPanel from "../components/StreetViewPanel.jsx";
import AmapResultMap from "../components/AmapResultMap.jsx";
import ResultPanel from "../components/ResultPanel.jsx";
import { fetchQuestions, submitAnswer } from "../services/api.js";

export default function GamePage({ group, onBack }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const amapApiKey = import.meta.env.VITE_AMAP_API_KEY || "";
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(true);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!group?.id) {
      return;
    }

    setStatus("loading");
    setGuess(null);
    setResult(null);
    setQuestionIndex(0);

    fetchQuestions(group.id)
      .then((items) => {
        setQuestions(items);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [group?.id]);

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
    return <div className="status-shell">正在加载题库...</div>;
  }

  if (status === "error") {
    return <div className="status-shell">加载失败：{error}</div>;
  }

  if (!question) {
    return (
      <main className="status-shell">
        当前题库组没有题目。
        <button className="secondary-btn status-btn" onClick={onBack}>
          返回首页
        </button>
      </main>
    );
  }

  const isLast = questionIndex === questions.length - 1;

  return !result ? (
    <main className="play-shell">
      <StreetViewPanel question={question} apiKey={googleMapsApiKey} fullscreen />
      <div className="streetview-vignette" />

      <div className="hud-top">
        <div className="hud-chip">
          <span>题库组</span>
          <strong>{group.title}</strong>
        </div>
        <div className="hud-chip">
          <span>题目</span>
          <strong>
            {questionIndex + 1} / {questions.length}
          </strong>
        </div>
        <div className="hud-chip hud-chip-accent">
          <span>状态</span>
          <strong>{guess ? "已放置标记" : "请选择位置"}</strong>
        </div>
      </div>

      <div className="hud-actions">
        <button className="secondary-btn" onClick={onBack}>
          返回首页
        </button>
      </div>

      <div className="hud-bottom">
        <section className={`mini-map-dock ${mapExpanded ? "expanded" : "collapsed"}`}>
          <button
            className="dock-toggle"
            type="button"
            onClick={() => setMapExpanded((current) => !current)}
          >
            <span>{mapExpanded ? "收起地图" : "展开地图"}</span>
            <strong>{mapExpanded ? "-" : "+"}</strong>
          </button>
          {mapExpanded ? (
            <div className="mini-map-wrap">
              <AmapGuessMap value={guess} onChange={setGuess} apiKey={amapApiKey} />
            </div>
          ) : null}
        </section>
        <section className="card floating-controls">
          <div className="eyebrow">当前题目</div>
          <p className="floating-title">{question.title}</p>
          <p>
            当前猜测：
            <strong>{guess ? ` ${guess.lat}, ${guess.lng}` : " 尚未选择"}</strong>
          </p>
          <button
            className="primary-btn"
            onClick={handleSubmit}
            disabled={!guess || status === "submitting"}
          >
            {status === "submitting" ? "提交中..." : "提交答案"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </div>
    </main>
  ) : (
    <main className="result-shell-cn">
      <section className="result-header card">
        <div>
          <p className="hero-kicker">结果页</p>
          <h1>{result.title}</h1>
          <p className="hero-copy">查看你的猜测和正确地点，并阅读这个地点的介绍。</p>
        </div>
        <button className="secondary-btn" onClick={onBack}>
          返回首页
        </button>
      </section>

      <section className="result-content-grid">
        <AmapResultMap result={result} apiKey={amapApiKey} />
        <ResultPanel result={result} onNext={handleNext} isLast={isLast} />
      </section>
    </main>
  );
}
