function buildStreetViewUrl(streetView, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    location: `${streetView.lat},${streetView.lng}`,
    heading: String(streetView.heading ?? 0),
    pitch: String(streetView.pitch ?? 0),
    fov: String(streetView.fov ?? 100)
  });

  if (streetView.panoId) {
    params.set("pano", streetView.panoId);
  }

  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

export default function StreetViewPanel({ question, apiKey, fullscreen = false }) {
  if (!apiKey) {
    return (
      <section className={`card question-card ${fullscreen ? "question-card-fullscreen" : ""}`}>
        <div className="eyebrow">Street View</div>
        <h1>{question.title}</h1>
        <div className="streetview-empty">
          <strong>Missing Google Maps API key</strong>
          <p>Set `VITE_GOOGLE_MAPS_API_KEY` in `apps/web/.env.local` to load Street View.</p>
        </div>
      </section>
    );
  }

  const src = buildStreetViewUrl(question.streetView, apiKey);

  return (
    <section className={`card question-card ${fullscreen ? "question-card-fullscreen" : ""}`}>
      {!fullscreen ? <div className="eyebrow">Street View</div> : null}
      {!fullscreen ? <h1>{question.title}</h1> : null}
      <div className="streetview-frame">
        <iframe
          title={question.title}
          src={src}
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
