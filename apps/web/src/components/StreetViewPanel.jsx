import { resolveApiAssetUrl } from "../services/api.js";

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

export function buildStreetViewEmbedUrl(streetView, apiKey) {
  return buildStreetViewUrl(streetView, apiKey);
}

export default function StreetViewPanel({ question, apiKey, fullscreen = false }) {
  if (question.sourceType === "image") {
    return (
      <section className={`card question-card ${fullscreen ? "question-card-fullscreen" : ""}`}>
        {!fullscreen ? <div className="eyebrow">图片题</div> : null}
        <div className="streetview-frame image-question-frame">
          <img src={resolveApiAssetUrl(question.imageUrl)} alt="题目图片" />
        </div>
      </section>
    );
  }

  if (!apiKey) {
    return (
      <section className={`card question-card ${fullscreen ? "question-card-fullscreen" : ""}`}>
        <div className="eyebrow">街景</div>
        <div className="streetview-empty">
          <strong>缺少 Google Maps API Key</strong>
          <p>请在 `apps/web/.env.local` 中配置 `VITE_GOOGLE_MAPS_API_KEY`。</p>
        </div>
      </section>
    );
  }

  const src = buildStreetViewUrl(question.streetView, apiKey);

  return (
    <section className={`card question-card ${fullscreen ? "question-card-fullscreen" : ""}`}>
      {!fullscreen ? <div className="eyebrow">街景</div> : null}
      <div className="streetview-frame">
        <iframe
          title="街景"
          src={src}
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
