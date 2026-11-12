import type { CatalogResponse, ContentItem, User } from "./types";

const API = ""; // same origin in dev via the Vite proxy; set VITE_API_URL for a deployed backend

function token(): string | null {
  return localStorage.getItem("ott_token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { errors?: string[]; message?: string }).errors?.join("; ") ?? (body as { message?: string }).message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  async login(email: string, password: string): Promise<User> {
    const data = await request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("ott_token", data.token);
    return data.user;
  },
  logout() {
    localStorage.removeItem("ott_token");
  },
  catalog(): Promise<CatalogResponse> {
    return request<CatalogResponse>("/api/catalog?limit=100");
  },
  create(item: Partial<ContentItem>): Promise<ContentItem> {
    return request<ContentItem>("/api/catalog", { method: "POST", body: JSON.stringify(item) });
  },
  update(id: number, item: Partial<ContentItem>): Promise<ContentItem> {
    return request<ContentItem>(`/api/catalog/${id}`, { method: "PUT", body: JSON.stringify(item) });
  },
  remove(id: number): Promise<void> {
    return request<void>(`/api/catalog/${id}`, { method: "DELETE" });
  },
};
