import { useState } from "react";
import { uploadMedia, resolveApiAssetUrl } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function MediaUploader({ mediaList, onChange }) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 校验
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError("仅支持 jpg/png/webp 图片或 mp4/webm/mov 视频");
      return;
    }
    if (isVideo && file.size > 100 * 1024 * 1024) {
      setError("视频不能超过 100MB");
      return;
    }
    if (isImage && file.size > 5 * 1024 * 1024) {
      setError("图片不能超过 5MB");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const result = await uploadMedia(file, token);
      const newMedia = { url: result.url, type: result.type, name: file.name };
      onChange([...(mediaList || []), newMedia]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }

    // 重置 input
    e.target.value = "";
  }

  function removeMedia(index) {
    const updated = (mediaList || []).filter((_, i) => i !== index);
    onChange(updated);
  }

  return (
    <div className="media-uploader">
      <div className="media-list">
        {(mediaList || []).map((media, i) => (
          <div key={i} className="media-item">
            {media.type === "image" ? (
              <img src={resolveApiAssetUrl(media.url)} alt={media.name || ""} />
            ) : (
              <video src={resolveApiAssetUrl(media.url)} controls preload="metadata" />
            )}
            <button
              type="button"
              className="media-remove-btn"
              onClick={() => removeMedia(i)}
              title="移除"
            >
              ×
            </button>
            <span className="media-name">{media.name}</span>
          </div>
        ))}
      </div>

      <label className="media-add-label">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
        <span className="secondary-btn media-add-btn">
          {uploading ? "上传中..." : "+ 添加图片/视频"}
        </span>
      </label>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
