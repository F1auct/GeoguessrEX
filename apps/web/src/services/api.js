const API_BASE = "http://localhost:3001/api";
const API_ORIGIN = "http://localhost:3001";

async function readJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || fallbackMessage || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function authHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
}

// ── Auth ──

export async function registerAccount(payload) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return readJson(response);
}

export function resolveApiAssetUrl(path) {
  if (!path) {
    return "";
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function loginAccount(payload) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return readJson(response);
}

export async function fetchCurrentUser(token) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(token)
  });

  return readJson(response);
}

// ── Groups ──

export async function fetchGroups(token) {
  const response = await fetch(`${API_BASE}/groups`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response, "加载题库组失败");
  return data.items;
}

export async function createGroup(payload, token) {
  const response = await fetch(`${API_BASE}/groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "创建题库组失败");
}

export async function updateGroup(groupId, payload, token) {
  const response = await fetch(`${API_BASE}/groups/${groupId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "更新题库组失败");
}

export async function deleteGroup(groupId, token) {
  const response = await fetch(`${API_BASE}/groups/${groupId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "删除题库组失败");
  }
}

// ── Questions ──

export async function fetchQuestions(groupId, token) {
  const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const response = await fetch(`${API_BASE}/questions${query}`, {
    headers: authHeaders(token)
  });
  const data = await readJson(response, "加载题目失败");
  return data.items;
}

export async function fetchQuestionsByGroup(groupId, token) {
  const response = await fetch(`${API_BASE}/groups/${groupId}/questions`, {
    headers: authHeaders(token)
  });
  return readJson(response, "加载题库组题目失败");
}

export async function createQuestion(payload, token) {
  const response = await fetch(`${API_BASE}/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "创建题目失败");
}

export async function updateQuestion(questionId, payload, token) {
  const response = await fetch(`${API_BASE}/questions/${questionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "更新题目失败");
}

export async function deleteQuestion(questionId, token) {
  const response = await fetch(`${API_BASE}/questions/${questionId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "删除题目失败");
  }
}

export async function uploadQuestionImage(file, token) {
  const body = new FormData();
  body.append("image", file);

  const response = await fetch(`${API_BASE}/uploads/images`, {
    method: "POST",
    headers: authHeaders(token),
    body
  });

  return readJson(response, "上传图片失败");
}

// ── Game ──

export async function submitAnswer(payload, token) {
  const response = await fetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error("提交答案失败");
    error.status = response.status;
    throw error;
  }

  return response.json();
}
