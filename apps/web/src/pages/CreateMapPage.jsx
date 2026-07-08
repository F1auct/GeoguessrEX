import { useMemo, useState } from "react";
import { createQuestion } from "../services/api.js";
import { buildStreetViewEmbedUrl } from "../components/StreetViewPanel.jsx";

const initialForm = {
  id: "",
  title: "",
  description: "",
  groupId: "new",
  streetViewUrl: ""
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

export default function CreateMapPage({ groups, onBack, onCreated }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const parsed = useMemo(() => parseStreetViewUrl(form.streetViewUrl), [form.streetViewUrl]);

  const preview = useMemo(() => {
    if (!form.id.trim() || !form.title.trim() || !parsed.streetView) {
      return null;
    }

    return {
      id: form.id.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      groupId: form.groupId,
      streetView: parsed.streetView
    };
  }, [form.id, form.title, form.description, form.groupId, parsed.streetView]);

  const previewSrc = useMemo(() => {
    if (!preview?.streetView || !googleMapsApiKey) {
      return "";
    }
    return buildStreetViewEmbedUrl(preview.streetView, googleMapsApiKey);
  }, [preview, googleMapsApiKey]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!preview) {
      setError(parsed.error || "请先填写完整信息");
      return;
    }

    setStatus("submitting");
    setError("");
    setCreated(null);

    try {
      const question = await createQuestion(preview);
      setCreated(question);
      setStatus("success");
      setForm(initialForm);
      onCreated?.(question);
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <main className="editor-shell">
      <section className="editor-panel">
        <div className="editor-header">
          <div>
            <p className="hero-kicker">新增题目</p>
            <h1>添加街景题目</h1>
            <p className="hero-copy">
              先去 Google Maps 打开街景，复制完整链接。系统会自动解析经纬度和视角参数。
            </p>
          </div>
          <button type="button" className="secondary-btn" onClick={onBack}>
            返回
          </button>
        </div>

        <section className="card guide-card">
          <div className="eyebrow">操作说明</div>
          <ol className="guide-list">
            <li>打开 `https://www.google.com.hk/maps` 并进入街景。</li>
            <li>调整到你想给玩家展示的画面。</li>
            <li>复制浏览器地址栏中的完整链接。</li>
            <li>填写题目基本信息并粘贴链接，系统会自动生成题目数据。</li>
          </ol>
        </section>

        <form className="editor-form card" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              <span>题目 ID</span>
              <input name="id" value={form.id} onChange={handleChange} placeholder="q5" required />
            </label>
            <label>
              <span>题目标题</span>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="东京十字路口"
                required
              />
            </label>
            <label>
              <span>题库组</span>
              <select name="groupId" value={form.groupId} onChange={handleChange}>
                {groups.map((group) => (
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
                placeholder="介绍这个地点的背景、辨识线索或文化信息"
              />
            </label>
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
          </div>

          <div className="form-help">
            <p>你现在只需要维护标题、介绍和街景链接，不需要再手填坐标和视角参数。</p>
            {form.streetViewUrl && parsed.error ? <p className="error-text">{parsed.error}</p> : null}
          </div>

          <div className="preview-block">
            <div className="eyebrow">街景预览</div>
            {!googleMapsApiKey ? (
              <div className="streetview-empty">
                <strong>缺少 Google Maps API Key</strong>
                <p>配置 `VITE_GOOGLE_MAPS_API_KEY` 后，这里会直接显示街景预览。</p>
              </div>
            ) : previewSrc ? (
              <div className="streetview-frame editor-preview-frame">
                <iframe
                  title="街景预览"
                  src={previewSrc}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="streetview-empty">
                <strong>等待预览</strong>
                <p>粘贴一个有效的街景链接后，这里会显示保存前的画面预览。</p>
              </div>
            )}
          </div>

          <div className="preview-block">
            <div className="eyebrow">预览 JSON</div>
            <pre className="json-preview">
              {preview ? JSON.stringify(preview, null, 2) : "粘贴一个有效的 Google Maps 街景链接后，这里会生成题目 JSON。"}
            </pre>
          </div>

          <div className="form-actions">
            <button className="primary-btn" type="submit" disabled={status === "submitting" || !preview}>
              {status === "submitting" ? "保存中..." : "保存题目"}
            </button>
            {error ? <p className="error-text">{error}</p> : null}
            {created ? <p className="success-text">已保存题目 `{created.id}`。</p> : null}
          </div>
        </form>
      </section>
    </main>
  );
}
