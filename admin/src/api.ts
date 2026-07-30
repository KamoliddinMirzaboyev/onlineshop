const BASE = import.meta.env.VITE_API_URL ?? "https://api.barakali-bozor.uz/api";

let token: string | null = localStorage.getItem("af_admin_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("af_admin_token", t);
  else localStorage.removeItem("af_admin_token");
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
    if (path !== "/admin/auth/login") location.href = "/login";
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

// Rasm faylini yuklash (multipart). onProgress 0–100.
export function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/admin/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        setToken(null);
        location.href = "/login";
        reject(new Error("Unauthorized"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`${xhr.status}: ${xhr.responseText.slice(0, 120)}`));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as { url: string };
        onProgress?.(100);
        resolve(data.url);
      } catch {
        reject(new Error("Server javobi o'qilmadi"));
      }
    };

    xhr.onerror = () => reject(new Error("Tarmoq xatosi — qayta urinib ko'ring"));
    xhr.onabort = () => reject(new Error("Yuklash bekor qilindi"));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
