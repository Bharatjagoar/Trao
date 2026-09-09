const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", "NETWORK_ERROR", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, data?.error?.code, res.status);
  }
  return data;
}

export const api = {
  register: (email, password) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),

  listKits: () => request("/api/kits"),
  createKit: (input) =>
    request("/api/kits", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createBatch: (cases) =>
    request("/api/kits/batch", {
      method: "POST",
      body: JSON.stringify({ cases }),
    }),
  getKit: (id) => request(`/api/kits/${id}`),
  deleteKit: (id) => request(`/api/kits/${id}`, { method: "DELETE" }),

  editBrief: (id, data) =>
    request(`/api/kits/${id}/brief`, { method: "PATCH", body: JSON.stringify(data) }),

  addQuestion: (id, data) =>
    request(`/api/kits/${id}/questions`, { method: "POST", body: JSON.stringify(data) }),
  editQuestion: (id, qid, data) =>
    request(`/api/kits/${id}/questions/${qid}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteQuestion: (id, qid) =>
    request(`/api/kits/${id}/questions/${qid}`, { method: "DELETE" }),
  reorderQuestions: (id, ids) =>
    request(`/api/kits/${id}/questions/order`, { method: "PUT", body: JSON.stringify({ ids }) }),
  pinQuestion: (id, qid) =>
    request(`/api/kits/${id}/questions/${qid}/pin`, { method: "POST" }),

  addFlashcard: (id, data) =>
    request(`/api/kits/${id}/flashcards`, { method: "POST", body: JSON.stringify(data) }),
  editFlashcard: (id, fid, data) =>
    request(`/api/kits/${id}/flashcards/${fid}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFlashcard: (id, fid) =>
    request(`/api/kits/${id}/flashcards/${fid}`, { method: "DELETE" }),

  regenerate: (id, section) =>
    request(`/api/kits/${id}/regenerate`, { method: "POST", body: JSON.stringify({ section }) }),

  recordPractice: (id, cardId, confidence) =>
    request(`/api/kits/${id}/practice/${cardId}`, {
      method: "POST",
      body: JSON.stringify({ confidence }),
    }),
  nextPractice: (id) => request(`/api/kits/${id}/practice/next`),
};
