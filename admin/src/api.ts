const BASE = import.meta.env.VITE_API_URL ?? "https://api.barakali-bozor.uz/api";

const TOKEN_KEY = "af_admin_token";
const REFRESH_KEY = "af_admin_token_refresh";
const LOGIN_PATH = "/admin/auth/login";

let token: string | null = localStorage.getItem(TOKEN_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

/** Login ikkala tokenni ham saqlaydi; `setToken(null)` — chiqish (ikkalasi o'chadi). */
export function setToken(t: string | null, r: string | null = null) {
  token = t;
  refreshToken = t ? r : null;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

/** Logout: tokenni serverda ham bekor qiladi (Redis qora ro'yxati).
 *  Tokenlar lokal tozalanishidan oldin nusxa olinadi; javob kutilmaydi —
 *  `keepalive` so'rov sahifa yopilsa ham yuboriladi. */
export function revokeSession(path: string): void {
  const t = token;
  const r = refreshToken;
  if (!t) return;
  void fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ refresh_token: r }),
    keepalive: true,
  }).catch(() => {});
}

export function hasToken() {
  return !!token;
}

function logout() {
  setToken(null);
  if (location.pathname !== "/login") location.href = "/login";
}

// Access token qisqa muddatli. Bir vaqtda bir nechta so'rov 401 olsa —
// hammasi bitta refreshni kutadi, aks holda parallel refreshlar bir-birining
// tokenini eskirtiradi.
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string | null;
    };
    setToken(data.access_token, data.refresh_token ?? null);
    return true;
  } catch {
    return false;
  }
}

function tryRefresh(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(
  path: string,
  opts: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    // Login so'rovining o'zi 401 qaytarsa (xato login/parol) — chaqiruvchi
    // (LoginPage) xatoni o'zi ko'rsatadi, sahifa qayta yuklanmaydi.
    if (path === LOGIN_PATH) throw new Error("Unauthorized");
    if (retry && (await tryRefresh())) return api<T>(path, opts, false);
    logout();
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
  retry = true,
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
        // Access token muddati tugagan bo'lishi mumkin — bir marta yangilaymiz.
        if (retry) {
          void tryRefresh().then((ok) => {
            if (ok) uploadImage(file, onProgress, false).then(resolve, reject);
            else {
              logout();
              reject(new Error("Unauthorized"));
            }
          });
          return;
        }
        logout();
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
