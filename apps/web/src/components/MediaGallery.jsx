import { resolveApiAssetUrl } from "../services/api.js";

export default function MediaGallery({ mediaList }) {
  if (!mediaList || mediaList.length === 0) {
    return null;
  }

  const images = mediaList.filter((m) => m.type === "image");
  const videos = mediaList.filter((m) => m.type === "video");

  return (
    <div className="media-gallery">
      {images.length > 0 ? (
        <div className="media-gallery-images">
          {images.map((media, i) => (
            <div key={i} className="media-gallery-item">
              <img
                src={resolveApiAssetUrl(media.url)}
                alt={media.name || `图片 ${i + 1}`}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      ) : null}
      {videos.length > 0 ? (
        <div className="media-gallery-videos">
          {videos.map((media, i) => (
            <div key={i} className="media-gallery-item">
              <video
                src={resolveApiAssetUrl(media.url)}
                controls
                preload="metadata"
                style={{ width: "100%", borderRadius: 14 }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
