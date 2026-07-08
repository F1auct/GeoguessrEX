import { useState } from "react";
import { loginAccount, registerAccount } from "../services/api.js";

export default function AuthPage({ onAuthenticated }) {
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

  const isRegistering = mode === "register";

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
      setError("Passwords do not match.");
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

      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <main className="landing-shell auth-shell">
      <section className="landing-panel auth-panel">
        <div>
          <p className="hero-kicker">Geo Search Account</p>
          <h1>{isRegistering ? "Create your explorer profile." : "Welcome back, explorer."}</h1>
          <p className="hero-copy">
            Sign in to keep the game tied to your map profile before dropping into the next
            street-view round.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs" aria-label="Authentication mode">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          {isRegistering ? (
            <>
              <label>
                <span>Username</span>
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
                <span>Email</span>
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
              <span>Email or username</span>
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
            <span>Password</span>
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
              <span>Confirm password</span>
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
              <span>Admin code</span>
              <input
                name="adminCode"
                type="password"
                value={form.adminCode}
                onChange={updateField}
                autoComplete="off"
                placeholder="Optional"
              />
            </label>
          ) : null}

          {error ? <p className="error-text auth-error">{error}</p> : null}

          <button className="primary-btn auth-submit" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Checking..." : isRegistering ? "Create Account" : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
