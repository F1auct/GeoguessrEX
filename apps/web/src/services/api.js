const API_BASE = "http://localhost:3001/api";

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }
  return data;
}

export async function fetchGroups() {
  const response = await fetch(`${API_BASE}/groups`);
  const data = await parseResponse(response, "加载题库组失败");
  return data.items;
}

export async function createGroup(payload) {
  const response = await fetch(`${API_BASE}/groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "创建题库组失败");
}

export async function updateGroup(groupId, payload) {
  const response = await fetch(`${API_BASE}/groups/${groupId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "更新题库组失败");
}

export async function deleteGroup(groupId) {
  const response = await fetch(`${API_BASE}/groups/${groupId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "删除题库组失败");
  }
}

export async function fetchQuestions(groupId) {
  const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const response = await fetch(`${API_BASE}/questions${query}`);
  const data = await parseResponse(response, "加载题目失败");
  return data.items;
}

export async function fetchQuestionsByGroup(groupId) {
  const response = await fetch(`${API_BASE}/groups/${groupId}/questions`);
  return parseResponse(response, "加载题库组题目失败");
}

export async function createQuestion(payload) {
  const response = await fetch(`${API_BASE}/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "创建题目失败");
}

export async function updateQuestion(questionId, payload) {
  const response = await fetch(`${API_BASE}/questions/${questionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "更新题目失败");
}

export async function deleteQuestion(questionId) {
  const response = await fetch(`${API_BASE}/questions/${questionId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "删除题目失败");
  }
}

export async function submitAnswer(payload) {
  const response = await fetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, "提交答案失败");
}
