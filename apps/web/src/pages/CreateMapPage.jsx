import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createQuestion, fetchGroups, resolveApiAssetUrl, uploadQuestionImage } from "../services/api.js";
import { buildStreetViewEmbedUrl } from "../components/StreetViewPanel.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const scenicImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=80"
];

const initialForm = {
  id: "",
  title: "",
  description: "",
  groupId: "",
  streetViewUrl: "",
  lat: "",
  lng: "",
  imageFile: null
};

function parseMaybeNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStreetViewUrl(rawUrl) {
  if (!rawUrl.trim()) {
    return { error: "请粘贴 Google Maps 街景链接", streetView: null };
  }

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { error: "链接格式无效", streetView: null };
  }

  const allowedHosts = new Set([
    "www.google.com",
    "google.com",
    "www.google.com.hk",
    "google.com.hk",
    "maps.app.goo.gl"
  ]);

  if (!allowedHosts.has(url.hostname)) {
    return { error: "请使用 Google Maps 链接", streetView: null };
  }

  const atMatch = url.href.match(/@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?),/);
  const dataMatch = url.href.match(/!3d(-?\d+(\.\d+)?)!4d(-?\d+(\.\d+)?)/);
  const lat = atMatch ? parseMaybeNumber(atMatch[1], NaN) : dataMatch ? parseMaybeNumber(dataMatch[1], NaN) : NaN;
  const lng = atMatch ? parseMaybeNumber(atMatch[3], NaN) : dataMatch ? parseMaybeNumber(dataMatch[3], NaN) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "无法从链接中解析经纬度，请复制完整街景链接", streetView: null };
  }

  const headingFromData = url.href.match(/!3f(-?\d+(\.\d+)?)/);
  const pitchFromData = url.href.match(/!4f(-?\d+(\.\d+)?)/);
  const fovFromData = url.href.match(/!5f(-?\d+(\.\d+)?)/);
  const panoMatch = url.href.match(/!1s([^!]+)!2e0/);

  return {
    error: null,
    streetView: {
      lat,
      lng,
      heading: parseMaybeNumber(url.searchParams.get("heading") ?? headingFromData?.[1] ?? "0", 0),
      pitch: parseMaybeNumber(url.searchParams.get("pitch") ?? pitchFromData?.[1] ?? "0", 0),
      fov: parseMaybeNumber(url.searchParams.get("fov") ?? fovFromData?.[1] ?? "100", 100),
      panoId: url.searchParams.get("pano") ?? panoMatch?.[1] ?? null
    }
  };
}

export default function CreateMapPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const [groups, setGroups] = useState([]);
  const editableGroups = useMemo(() => groups.filter((group) => group.canEdit), [groups]);
  const [mode, setMode] = useState("street_view");
  const [form, setForm] = useState({ ...initialForm, groupId: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    fetchGroups(token)
      .then((items) => {
        setGroups(items);
        const editable = items.filter((group) => group.canEdit);
        if (editable.length > 0) {
          setForm((current) => {
            if (editable.some((group) => group.id === current.groupId)) {
              return current;
            }
            return { ...current, groupId: editable[0].id };
          });
        }
      })
      .catch((err) => {
        if (err.status === 401) {
          navigate("/login");
        }
      });
  }, [token, navigate]);

  useEffect(() => {
    if (!editableGroups.length) {
      return;
    }

    setForm((current) => {
      if (editableGroups.some((group) => group.id === current.groupId)) {
        return current;
      }
      return {
        ...current,
        groupId: editableGroups[0].id
      };
    });
  }, [editableGroups]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % scenicImages.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, []);

  const parsed = useMemo(() => parseStreetViewUrl(form.streetViewUrl), [form.streetViewUrl]);
  const imagePreviewUrl = useMemo(
    () => (form.imageFile ? URL.createObjectURL(form.imageFile) : resolveApiAssetUrl(uploadedImageUrl)),
    [form.imageFile, uploadedImageUrl]
  );

  const streetViewPreview = useMemo(() => {
    if (!form.id.trim() || !form.title.trim() || !parsed.streetView) {
      return null;
    }
    return {
      id: form.id.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      groupId: form.groupId,
      sourceType: "street_view",
      streetView: parsed.streetView
    };
  }, [form.id, form.title, form.description, form.groupId, parsed.streetView]);

  const previewSrc = useMemo(() => {
    if (!streetViewPreview?.streetView || !googleMapsApiKey) {
      return "";
    }
    return buildStreetViewEmbedUrl(streetViewPreview.streetView, googleMapsApiKey);
  }, [streetViewPreview, googleMapsApiKey]);

  function handleChange(event) {
    const { name, value, files } = event.target;
    setForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : value
    }));
    if (name === "imageFile") {
      setUploadedImageUrl("");
    }
  }

  function resetForm() {
    setForm({ ...initialForm, groupId: form.groupId || editableGroups[0]?.id || "" });
    setUploadedImageUrl("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    setCreated(null);

    try {
      if (!editableGroups.length) {
        throw new Error("请先创建至少一个可编辑题库，再添加题目");
      }

      let payload;
      if (mode === "street_view") {
        if (!streetViewPreview) {
          throw new Error(parsed.error || "请先填写完整街景题目信息");
        }
        payload = streetViewPreview;
      } else {
        const lat = Number.parseFloat(form.lat);
        const lng = Number.parseFloat(form.lng);
        if (!form.imageFile && !uploadedImageUrl) {
          throw new Error("请先选择本地图片");
        }
        if (!form.description.trim()) {
          throw new Error("请填写图片题的地点介绍");
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("请填写有效经纬度");
        }

        const upload = uploadedImageUrl ? { imageUrl: uploadedImageUrl } : await uploadQuestionImage(form.imageFile, token);
        setUploadedImageUrl(upload.imageUrl);
        payload = {
          id: form.id.trim(),
          title: form.title.trim(),
          description: form.description.trim(),
          groupId: form.groupId,
          sourceType: "image",
          imageUrl: upload.imageUrl,
          lat,
          lng
        };
      }

      const question = await createQuestion(payload, token);
      setCreated(question);
      setStatus("success");
      resetForm();
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (!editableGroups.length) {
    return (
      <main className="editor-shell landing-shell-cinematic">
        <div className="auth-backdrop card page-backdrop">
          <div className="scenic-stage-images">
            {scenicImages.map((image, index) => (
              <div
                key={image}
                className={`scenic-stage-image ${index === activeImageIndex ? "active" : ""}`}
                style={{ backgroundImage: `url(${image})` }}
              />
            ))}
          </div>
          <div className="auth-backdrop-overlay" />
        </div>
        <section className="editor-panel">
          <div className="editor-header">
            <div>
              <p className="hero-kicker">Add Question</p>
              <h1>还不能直接添加题目。</h1>
              <p className="hero-copy">
                题目必须先属于一个题库。你现在没有可编辑题库，所以这一步先被拦住了，避免用户在错误路径里白填表单。
              </p>
            </div>
            <button type="button" className="secondary-btn" onClick={() => navigate("/")}>
              返回首页
            </button>
          </div>

          <section className="card empty-state-card">
            <div className="eyebrow">前置条件</div>
            <h2>先去创建题库，再回来加题</h2>
            <p className="empty-text">
              去管理页创建一个题库后，这里的表单会自动开放。创建题库通常只需要填写一个稳定的 ID 和一个展示名称。
            </p>
            <div className="manage-actions">
              <button className="primary-btn" type="button" onClick={() => navigate("/manage")}>
                去创建题库
              </button>
              <button className="secondary-btn" type="button" onClick={() => navigate("/")}>
                返回首页
              </button>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="editor-shell landing-shell-cinematic">
      <div className="auth-backdrop card page-backdrop">
        <div className="scenic-stage-images">
          {scenicImages.map((image, index) => (
            <div
              key={image}
              className={`scenic-stage-image ${index === activeImageIndex ? "active" : ""}`}
              style={{ backgroundImage: `url(${image})` }}
            />
          ))}
        </div>
        <div className="auth-backdrop-overlay" />
      </div>
      <section className="editor-panel">
        <div className="editor-header">
          <div>
            <p className="hero-kicker">Add Question</p>
            <h1>往题库里补题。</h1>
            <p className="hero-copy">
              你可以通过 Google 街景链接创建街景题，也可以上传本地图片创建图片题。先确认归属题库，再填写题目内容。
            </p>
          </div>
          <button type="button" className="secondary-btn" onClick={() => navigate("/")}>
            返回首页
          </button>
        </div>

        <div className="guide-card card compact-guide">
          <div className="eyebrow">当前状态</div>
          <p className="hero-copy">
            你目前有 {editableGroups.length} 个可编辑题库。建议一题一题地录入，先保存核心信息，再检查预览是否正常。
          </p>
        </div>

        <form className="editor-form card" onSubmit={handleSubmit}>
          <div className="auth-tabs editor-tabs">
            <button className={mode === "street_view" ? "active" : ""} type="button" onClick={() => setMode("street_view")}>
              街景链接
            </button>
            <button className={mode === "image" ? "active" : ""} type="button" onClick={() => setMode("image")}>
              本地图片
            </button>
          </div>

          <div className="form-grid">
            <label>
              <span>题目 ID</span>
              <input name="id" value={form.id} onChange={handleChange} placeholder="q5" required />
            </label>
            <label>
              <span>题目标题</span>
              <input name="title" value={form.title} onChange={handleChange} placeholder="东京十字路口" required />
            </label>
            <label>
              <span>归属题库</span>
              <select name="groupId" value={form.groupId} onChange={handleChange}>
                {editableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-grid-wide">
              <span>地点介绍</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="补充识别线索、背景信息或你希望玩家注意到的细节"
                required={mode === "image"}
              />
            </label>

            {mode === "street_view" ? (
              <label className="form-grid-wide">
                <span>Google Maps 街景链接</span>
                <input
                  name="streetViewUrl"
                  value={form.streetViewUrl}
                  onChange={handleChange}
                  placeholder="https://www.google.com.hk/maps/..."
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  <span>纬度</span>
                  <input name="lat" value={form.lat} onChange={handleChange} placeholder="30.53786" required />
                </label>
                <label>
                  <span>经度</span>
                  <input name="lng" value={form.lng} onChange={handleChange} placeholder="114.36255" required />
                </label>
                <label className="form-grid-wide">
                  <span>本地图片</span>
                  <input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} required />
                </label>
              </>
            )}
          </div>

          {mode === "street_view" ? (
            <div className="preview-block">
              <div className="eyebrow">街景预览</div>
              {!googleMapsApiKey ? (
                <div className="streetview-empty">
                  <strong>缺少 Google Maps API Key</strong>
                  <p>配置 `VITE_GOOGLE_MAPS_API_KEY` 后，这里会直接显示街景预览。</p>
                </div>
              ) : previewSrc ? (
                <div className="streetview-frame editor-preview-frame">
                  <iframe title="街景预览" src={previewSrc} allowFullScreen loading="lazy" />
                </div>
              ) : (
                <div className="streetview-empty">
                  <strong>等待预览</strong>
                  <p>粘贴有效街景链接后，这里会显示保存前的预览画面。</p>
                </div>
              )}
              {form.streetViewUrl && parsed.error ? <p className="error-text">{parsed.error}</p> : null}
            </div>
          ) : (
            <div className="preview-block">
              <div className="eyebrow">图片预览</div>
              {imagePreviewUrl ? (
                <div className="streetview-frame editor-preview-frame image-question-frame">
                  <img src={imagePreviewUrl} alt="题目预览" />
                </div>
              ) : (
                <div className="streetview-empty">
                  <strong>等待图片</strong>
                  <p>选择 jpg、png 或 webp 后，这里会显示保存前的预览画面。</p>
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button className="primary-btn" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "保存中..." : "保存题目"}
            </button>
            {error ? <p className="error-text">{error}</p> : null}
            {created ? <p className="success-text">题目 `{created.id}` 已保存。</p> : null}
          </div>
        </form>
      </section>
    </main>
  );
}
