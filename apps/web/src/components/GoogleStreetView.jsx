export default function GoogleStreetView({ lat, lng, heading = 0, pitch = 0, fov = 90, apiKey }) {
  if (!apiKey) {
    return (
      <div className="streetview-empty" style={{ minHeight: "100vh" }}>
        <strong>缺少 Google Maps API Key</strong>
        <p>配置 VITE_GOOGLE_MAPS_API_KEY 后加载街景。</p>
      </div>
    );
  }

  const params = new URLSearchParams({
    key: apiKey,
    location: `${lat},${lng}`,
    heading: String(heading),
    pitch: String(pitch),
    fov: String(fov || 90)
  });

  const src = `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <iframe
        title="Street View"
        src={src}
        allowFullScreen
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: "100%", height: "100%", border: 0, display: "block",
          position: "absolute", inset: 0
        }}
      />
      {/* 遮罩覆盖 Google 左上角 UI */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: "280px", height: "60px",
        background: "linear-gradient(to bottom, rgba(16,22,21,0.95), transparent)",
        pointerEvents: "none", zIndex: 5
      }} />
      {/* 遮罩覆盖 Google 右下角水印 */}
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: "160px", height: "36px",
        background: "linear-gradient(to top, rgba(16,22,21,0.9), transparent)",
        pointerEvents: "none", zIndex: 5
      }} />
    </div>
  );
}
