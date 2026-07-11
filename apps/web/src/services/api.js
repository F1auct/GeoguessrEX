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

// ── Wallet ──

export async function fetchWallet(token) {
  const response = await fetch(`${API_BASE}/wallet`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取钱包信息失败");
}

export async function rechargeWallet(amount, token) {
  const response = await fetch(`${API_BASE}/wallet/recharge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ amount })
  });
  return readJson(response, "充值失败");
}

export async function withdrawWallet(amount, token) {
  const response = await fetch(`${API_BASE}/wallet/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ amount })
  });
  return readJson(response, "提现失败");
}

export async function fetchTransactions(token) {
  const response = await fetch(`${API_BASE}/wallet/transactions`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取交易记录失败");
}

// ── Bounties ──

export async function fetchBounties(status = "") {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${API_BASE}/bounties${query}`);
  return readJson(response, "获取悬赏列表失败");
}

export async function fetchBounty(id) {
  const response = await fetch(`${API_BASE}/bounties/${id}`);
  return readJson(response, "获取悬赏详情失败");
}

export async function createBounty(payload, token) {
  const response = await fetch(`${API_BASE}/bounties`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "创建悬赏失败");
}

export async function submitBountyAnswer(bountyId, guess, token) {
  const response = await fetch(`${API_BASE}/bounties/${bountyId}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ guess })
  });
  return readJson(response, "提交答案失败");
}

export async function closeBounty(bountyId, token) {
  const response = await fetch(`${API_BASE}/bounties/${bountyId}/close`, {
    method: "POST",
    headers: authHeaders(token)
  });
  return readJson(response, "关闭悬赏失败");
}

export async function fetchBountySubmissions(bountyId, token) {
  const response = await fetch(`${API_BASE}/bounties/${bountyId}/submissions`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取提交记录失败");
}

// ── Games ──

export async function fetchGames({ region, gameType, status } = {}) {
  const params = new URLSearchParams();
  if (region) params.set("region", region);
  if (gameType) params.set("gameType", gameType);
  if (status) params.set("status", status);
  const query = params.toString();
  const response = await fetch(`${API_BASE}/games${query ? `?${query}` : ""}`);
  return readJson(response, "获取游戏列表失败");
}

export async function fetchGame(id) {
  const response = await fetch(`${API_BASE}/games/${id}`);
  return readJson(response, "获取游戏详情失败");
}

export async function createGame(payload, token) {
  const response = await fetch(`${API_BASE}/games`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "创建游戏失败");
}

export async function registerForGame(gameId, playerInfo, token) {
  const response = await fetch(`${API_BASE}/games/${gameId}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ playerInfo })
  });
  return readJson(response, "报名失败");
}

export async function fetchGameRegistrations(gameId, token) {
  const response = await fetch(`${API_BASE}/games/${gameId}/registrations`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取报名列表失败");
}

export async function approveRegistration(gameId, regId, action, token) {
  const response = await fetch(`${API_BASE}/games/${gameId}/registrations/${regId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ action })
  });
  return readJson(response, "审核报名失败");
}

export async function fetchGameProgress(gameId, token) {
  const response = await fetch(`${API_BASE}/games/${gameId}/progress`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取进度失败");
}

export async function completeGameStep(gameId, payload, token) {
  const response = await fetch(`${API_BASE}/games/${gameId}/progress/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "完成步骤失败");
}

// ── Community ──

export async function fetchPosts({ category, region } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (region) params.set("region", region);
  const query = params.toString();
  const response = await fetch(`${API_BASE}/community${query ? `?${query}` : ""}`);
  return readJson(response, "获取帖子列表失败");
}

export async function fetchPost(id) {
  const response = await fetch(`${API_BASE}/community/${id}`);
  return readJson(response, "获取帖子详情失败");
}

export async function fetchMyPosts(token) {
  const response = await fetch(`${API_BASE}/community/my`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取我的帖子失败");
}

export async function createPost(payload, token) {
  const response = await fetch(`${API_BASE}/community`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "发布帖子失败");
}

export async function deletePost(postId, token) {
  const response = await fetch(`${API_BASE}/community/${postId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "删除帖子失败");
  }
}

// ── Uploads ──

export async function uploadMedia(file, token) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_BASE}/uploads/media`, {
    method: "POST",
    headers: authHeaders(token),
    body
  });

  return readJson(response, "上传失败");
}

// ── Reviews ──

export async function fetchPendingReviews(token) {
  const response = await fetch(`${API_BASE}/reviews/pending`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取待审核列表失败");
}

export async function fetchRevokedReviews(token) {
  const response = await fetch(`${API_BASE}/reviews/revoked`, {
    headers: authHeaders(token)
  });
  return readJson(response, "获取已撤销列表失败");
}

export async function revokeReview(payload, token) {
  const response = await fetch(`${API_BASE}/reviews/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "撤销审核失败");
}

export async function performReview(payload, token) {
  const response = await fetch(`${API_BASE}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(payload)
  });
  return readJson(response, "审核失败");
}
