import { getUserFromToken, loginUser, registerUser } from "../services/authService.js";

export function registerAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = await registerUser(req.body || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch {
      return res.status(500).json({ error: "Failed to register account." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = await loginUser(req.body || {});
      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Failed to login." });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const header = req.get("authorization") || "";
      const [scheme, token] = header.split(" ");

      if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return res.status(401).json({ error: "Invalid or expired token." });
      }

      return res.json({ user });
    } catch {
      return res.status(500).json({ error: "Failed to read session." });
    }
  });
}
