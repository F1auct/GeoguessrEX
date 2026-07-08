import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchCurrentUser } from "../services/api.js";

const tokenStorageKey = "geoguesr.authToken";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({
    status: "checking",
    token: localStorage.getItem(tokenStorageKey) || "",
    user: null
  });

  useEffect(() => {
    if (!session.token) {
      setSession({ status: "guest", token: "", user: null });
      return;
    }

    let cancelled = false;

    fetchCurrentUser(session.token)
      .then(({ user }) => {
        if (!cancelled) {
          setSession((prev) => ({ ...prev, status: "authenticated", user }));
        }
      })
      .catch(() => {
        localStorage.removeItem(tokenStorageKey);
        if (!cancelled) {
          setSession({ status: "guest", token: "", user: null });
        }
      });

    return () => { cancelled = true; };
  }, [session.token]);

  const login = useCallback(({ token, user }) => {
    localStorage.setItem(tokenStorageKey, token);
    setSession({ status: "authenticated", token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(tokenStorageKey);
    setSession({ status: "guest", token: "", user: null });
  }, []);

  const value = {
    user: session.user,
    token: session.token,
    isAuthenticated: session.status === "authenticated",
    status: session.status,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
