const BASE = import.meta.env.VITE_API_URL ?? "https://api.barakali-bozor.uz/api";

const TOKEN_KEY = "af_business_token";
const REFRESH_KEY = "af_business_token_refresh";
const LOGIN_PATH = "/business/auth/login";

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
export const del = <T = void>(p: string) => api<T>(p, { method: "DELETE" });

// Businessman /admin/* endpointlariga qaysi do'kon ustida ishlayotganini
// bildiruvchi ?restaurant_id= ni markazdan qo'shamiz.
export function withStore(path: string, storeId: number): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}restaurant_id=${storeId}`;
}

// "Barcha do'konlar" ko'rinishi — har bir do'kon uchun alohida so'rov, natijalar
// birlashtiriladi. Backend bitta do'kon bo'yicha ishlaydi, shu tashqi qatlam
// ko'p do'konni jamlaydi.
export async function getAll<T>(path: string, storeIds: number[]): Promise<T[]> {
  const lists = await Promise.all(storeIds.map((id) => get<T[]>(withStore(path, id))));
  return lists.flat();
}

// Rasm faylini yuklash (multipart). Content-Type ni brauzer o'zi qo'yadi.
export async function uploadImage(file: File, retry = true): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/admin/upload`, { method: "POST", body: form, headers });
  if (res.status === 401 && retry && (await tryRefresh())) {
    return uploadImage(file, false);
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()).url as string;
}
