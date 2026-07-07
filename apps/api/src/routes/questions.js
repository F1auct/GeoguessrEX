import { getQuestionById, listQuestions } from "../services/questionBank.js";

export function registerQuestionRoutes(app) {
  app.get("/api/questions", (_req, res) => {
    res.json({ items: listQuestions() });
  });

  app.get("/api/questions/:id", (req, res) => {
    const question = getQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    return res.json({
      id: question.id,
      title: question.title,
      streetView: question.streetView
    });
  });
}
