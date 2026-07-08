import { getUserFromToken } from "../services/authService.js";

export async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(500).json({ error: "Failed to validate session." });
  }
}
