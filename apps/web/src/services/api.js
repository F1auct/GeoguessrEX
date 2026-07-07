const API_BASE = "http://localhost:3001/api";

export async function fetchQuestions() {
  const response = await fetch(`${API_BASE}/questions`);
  if (!response.ok) {
    throw new Error("Failed to load questions");
  }
  return response.json();
}

export async function submitAnswer(payload) {
  const response = await fetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Failed to submit answer");
  }

  return response.json();
}
