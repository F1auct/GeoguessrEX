import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { loginAccount, registerAccount } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const scenicImages = [
  "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80"
];

export default function AuthPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    identifier: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    adminCode: ""
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const isRegistering = mode === "register";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % scenicImages.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setStatus("idle");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isRegistering && form.password !== form.confirmPassword) {
      setError("两次密码输入不一致。");
      return;
    }

    setStatus("submitting");

    try {
      const result = isRegistering
        ? await registerAccount({
            username: form.username,
            email: form.email,
            password: form.password,
            adminCode: form.adminCode.trim() || undefined
          })
        : await loginAccount({
            identifier: form.identifier,
            password: form.password
          });

      login(result);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <main className="landing-shell auth-shell auth-shell-cinematic">
      <section className="auth-stage">
        <div className="auth-backdrop card">
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

        <section className="auth-stage-grid">
          <div className="auth-copy-panel auth-copy-panel-minimal">
            <div className="brand-mark">
              <span>GEO</span>
              <strong>GUESSREX</strong>
            </div>
          </div>

          <form className="auth-form auth-form-rich" onSubmit={handleSubmit}>
            <div className="auth-tabs" aria-label="Authentication mode">
              <button
                className={mode === "login" ? "active" : ""}
                type="button"
                onClick={() => switchMode("login")}
              >
                登录
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                type="button"
                onClick={() => switchMode("register")}
              >
                注册
              </button>
            </div>

            {isRegistering ? (
              <>
                <label>
                  <span>用户名</span>
                  <input
                    name="username"
                    value={form.username}
                    onChange={updateField}
                    autoComplete="username"
                    minLength={3}
                    required
                  />
                </label>
                <label>
                  <span>邮箱</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    autoComplete="email"
                    required
                  />
                </label>
              </>
            ) : (
              <label>
                <span>邮箱或用户名</span>
                <input
                  name="identifier"
                  value={form.identifier}
                  onChange={updateField}
                  autoComplete="username"
                  required
                />
              </label>
            )}

            <label>
              <span>密码</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                autoComplete={isRegistering ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </label>

            {isRegistering ? (
              <label>
                <span>确认密码</span>
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            ) : null}

            {isRegistering ? (
              <label>
                <span>管理员邀请码</span>
                <input
                  name="adminCode"
                  type="password"
                  value={form.adminCode}
                  onChange={updateField}
                  autoComplete="off"
                  placeholder="可选"
                />
              </label>
            ) : null}

            {error ? <p className="error-text auth-error">{error}</p> : null}

            <button className="primary-btn auth-submit" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "处理中..." : isRegistering ? "创建账户" : "登录"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
