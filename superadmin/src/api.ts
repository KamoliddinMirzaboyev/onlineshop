const BASE = import.meta.env.VITE_API_URL ?? "https://api.barakali-bozor.uz/api";

let token: string | null = localStorage.getItem("af_platform_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("af_platform_token", t);
  else localStorage.removeItem("af_platform_token");
}

export function hasToken() {
  return !!token;
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    setToken(null);
    // Login so'rovining o'zi 401 qaytarsa (xato login/parol) — sahifani
    // qayta yuklamaymiz, chaqiruvchi (LoginPage) xatoni o'zi ko'rsatadi.
    if (path !== "/platform/auth/login") location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, body: unknown) =>
  api<T>(p, { method: "POST", body: JSON.stringify(body) });
export const put = <T>(p: string, body: unknown) =>
  api<T>(p, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T>(p: string, body: unknown) =>
  api<T>(p, { method: "PATCH", body: JSON.stringify(body) });
export const del = (p: string) => api<void>(p, { method: "DELETE" });

// Rasm faylini yuklash (multipart). Content-Type ni brauzer o'zi qo'yadi.
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/admin/upload`, { method: "POST", body: form, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()).url as string;
}
