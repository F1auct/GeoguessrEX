import { getQuestionById } from "./questionBank.js";
import { haversineDistanceKm } from "../utils/haversine.js";
import { scoreFromDistance } from "../utils/scoring.js";

export function gradeAnswer(questionId, guess) {
  const question = getQuestionById(questionId);
  if (!question) {
    return { error: "Question not found", status: 404 };
  }

  if (
    typeof guess?.lat !== "number" ||
    typeof guess?.lng !== "number" ||
    Number.isNaN(guess.lat) ||
    Number.isNaN(guess.lng)
  ) {
    return { error: "Invalid guess payload", status: 400 };
  }

  const distanceKm = haversineDistanceKm(
    guess.lat,
    guess.lng,
    question.streetView.lat,
    question.streetView.lng
  );

  return {
    questionId: question.id,
    description: question.description,
    groupId: question.groupId,
    groupTitle: question.groupTitle,
    guess,
    answer: {
      lat: question.streetView.lat,
      lng: question.streetView.lng
    },
    streetView: question.streetView,
    distanceKm,
    score: scoreFromDistance(distanceKm)
  };
}
