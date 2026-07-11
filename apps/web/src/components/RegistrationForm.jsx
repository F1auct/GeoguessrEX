import { useState } from "react";

export default function RegistrationForm({ playerInfoFields, onSubmit, onCancel }) {
  const [form, setForm] = useState({});
  const [consented, setConsented] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!consented) {
      return;
    }
    onSubmit(form);
  }

  return (
    <div className="card registration-form-card">
      <div className="eyebrow">报名信息</div>
      <p className="form-help">
        游戏发起方需要以下信息才能审核你的报名：
      </p>
      <ul className="info-fields-list">
        {(playerInfoFields || []).map((field) => (
          <li key={field}>{field === "name" ? "姓名" : field === "phone" ? "手机号" : field === "id_card" ? "身份证号" : field}</li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        {(playerInfoFields || []).map((field) => (
          <label key={field}>
            <span>{field === "name" ? "姓名" : field === "phone" ? "手机号" : field === "id_card" ? "身份证号" : field}</span>
            <input
              type={field === "phone" ? "tel" : "text"}
              value={form[field] || ""}
              onChange={(e) => handleChange(field, e.target.value)}
              required
            />
          </label>
        ))}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <span>我同意将以上信息提供给游戏发起方用于报名审核</span>
        </label>
        <div className="form-actions">
          <button className="primary-btn" type="submit" disabled={!consented}>
            允许并报名
          </button>
          <button className="secondary-btn" type="button" onClick={onCancel}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
