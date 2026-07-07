import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "src", "data", "questions.json");

export function readQuestions() {
  const raw = fs.readFileSync(dataPath, "utf8");
  return JSON.parse(raw);
}

export function listQuestions() {
  return readQuestions().map((question) => ({
    id: question.id,
    title: question.title,
    streetView: question.streetView
  }));
}

export function getQuestionById(id) {
  return readQuestions().find((question) => question.id === id) ?? null;
}
