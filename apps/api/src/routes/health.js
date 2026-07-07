export function registerHealthRoute(app) {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
}
