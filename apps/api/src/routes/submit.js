import { gradeAnswer } from "../services/gameService.js";
import { requireAuth } from "../middleware/auth.js";

export function registerSubmitRoute(app) {
  app.post("/api/submit", requireAuth, (req, res) => {
    const result = gradeAnswer(req.body?.questionId, req.body?.guess);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json(result);
  });
}
