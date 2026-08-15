// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
// Cliente de la API REST v1 (P4: la UI es un cliente más).
// El token se guarda en localStorage; cada petición lleva Bearer.

export interface DocSummary {
  id: string;
  title: string;
  path: string;
  updated_at: string;
}

export interface DocDetail extends DocSummary {
  content: string;
  content_hash: string;
}

export interface Task {
  id: string;
  title: string;
  done: number;
  in_progress: number;
  due_date: string | null;
  project: string | null;
  priority: string | null;
  assignee: string | null;
  line_no: number;
  doc_id: string;
}

export interface SearchResult {
  id: string;
  title: string;
  path: string;
}

const TOKEN_KEY = "hub:token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const authApi = {
  register: (email: string, password: string, displayName: string) =>
    api<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    }),
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};

export const docsApi = {
  list: () => api<{ docs: DocSummary[] }>("/docs"),
  get: (id: string) => api<DocDetail>(`/docs/${id}`),
  create: (path: string, title: string, content: string) =>
    api<DocSummary>("/docs", {
      method: "POST",
      body: JSON.stringify({ path, title, content }),
    }),
  update: (id: string, content: string) =>
    api<{ content_hash: string }>(`/docs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),
};

export const tasksApi = {
  list: (done = false) =>
    api<{ tasks: Task[] }>(`/tasks?done=${done ? 1 : 0}`),
  listVista: (vista: string, params: Record<string, string> = {}) => {
    const q = new URLSearchParams({ vista, ...params }).toString();
    return api<{ tasks: Task[] }>(`/tasks?${q}`);
  },
  patch: (id: string, patch: { done: boolean }) =>
    api<{ done: boolean }>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  quickAdd: (text: string) =>
    api<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

export const searchApi = {
  docs: (q: string) => api<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`),
};

export const workspacesApi = {
  create: (slug: string, name: string) =>
    api<{ id: string }>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ slug, name }),
    }),
  list: () =>
    api<{ workspaces: Array<{ id: string; slug: string; name: string; role: string }> }>(
      "/workspaces",
    ),
};
