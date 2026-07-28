import {
  isTelegramDesktopLike,
  isTelegramLocationGranted,
  requestTelegramLocation,
} from "../telegram";
import type { Address, Order, Restaurant, RestaurantDetail, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "https://allfoodapi.webportfolio.uz/api";

export class OutOfRangeError extends Error {}
export class LocationDeniedError extends Error {}

let token: string | null = localStorage.getItem("af_token");

export function setToken(t: string) {
  token = t;
  localStorage.setItem("af_token", t);
}

// ── Joylashuv kesh (sessiya + xotira) ─────────────────────────────
// Bir marta ruxsat → keyingi ochilish/checkout qayta so'ramaydi.
const COORDS_SS_KEY = "af_coords_v1";
const ADDR_SS_KEY = "af_addr_v1";
const COORDS_TTL_MS = 30 * 60 * 1000; // 30 daqiqa

type Coords = { lat: number; lng: number };

let coordsCache: Coords | null | undefined;
let coordsPromise: Promise<Coords | null> | null = null;

export type LocationIssue = "device_off" | "denied" | "other";
let lastLocationIssue: LocationIssue | null = null;
export function getLastLocationIssue(): LocationIssue | null {
  return lastLocationIssue;
}

export function hasLocationPermissionHint(): boolean {
  return isTelegramLocationGranted();
}

function readStoredCoords(): Coords | null {
  try {
    const raw = sessionStorage.getItem(COORDS_SS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { lat: number; lng: number; t: number };
    if (
      typeof d.lat === "number" &&
      typeof d.lng === "number" &&
      Date.now() - d.t < COORDS_TTL_MS
    ) {
      return { lat: d.lat, lng: d.lng };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredCoords(c: Coords) {
  try {
    sessionStorage.setItem(COORDS_SS_KEY, JSON.stringify({ ...c, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

function rememberCoords(c: Coords): Coords {
  lastLocationIssue = null;
  coordsCache = c;
  writeStoredCoords(c);
  return c;
}

/** Reverse-geocode natijasini saqlash — checkout darhol manzil ko'rsatadi. */
export function cacheAddressLabel(line: string) {
  try {
    if (line.trim()) sessionStorage.setItem(ADDR_SS_KEY, line.trim());
  } catch {
    /* ignore */
  }
}

export function peekAddressLabel(): string | null {
  try {
    return sessionStorage.getItem(ADDR_SS_KEY);
  } catch {
    return null;
  }
}

/**
 * Brauzer geolocation.
 * @param silent true — ruxsat dialogi ochilmasin (faqat kesh/maximumAge).
 *   Checkout va qayta urinishlarda silent: Telegram ruxsati yetarli.
 */
function browserCoords(timeoutMs: number, silent: boolean): Promise<Coords | null> {
  if (!navigator.geolocation) return Promise.resolve(null);

  // Silent: agar ruxsat holati denied/prompt bo'lsa — dialog ochmasdan chiqamiz.
  // "granted" bo'lsa maximumAge bilan tez o'qiymiz.
  const run = (): Promise<Coords | null> =>
    new Promise((resolve) => {
      let done = false;
      const finish = (v: Coords | null) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(timer);
          finish({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          window.clearTimeout(timer);
          finish(null);
        },
        {
          enableHighAccuracy: false,
          timeout: timeoutMs,
          // Silent: faqat keshlangan qiymat; aks holda 5 daqiqa kesh OK.
          maximumAge: silent ? Infinity : 300_000,
        },
      );
    });

  if (silent && navigator.permissions?.query) {
    return navigator.permissions
      .query({ name: "geolocation" })
      .then((st) => (st.state === "granted" ? run() : null))
      .catch(() => null);
  }
  // Silent lekin Permissions API yo'q — xavfsiz: dialog ochilishi mumkin.
  // Shuning uchun silent + no API → null (faqat Telegram ishlatiladi).
  if (silent) return Promise.resolve(null);
  return run();
}

/**
 * Joylashuv olish.
 * - Birinchi marta: Telegram prompt (yoki brauzer desktopda)
 * - Keyin: xotira/session kesh → qayta ruxsat YO'Q
 * - force: yangilash, lekin ruxsat qayta so'ralmaydi (silent refresh)
 */
export function getCoords(force = false): Promise<Coords | null> {
  // Yangi sessiya: sessionStorage dan tiklash (checkout qayta so'ramasligi uchun)
  if (coordsCache === undefined && !force) {
    const stored = readStoredCoords();
    if (stored) {
      coordsCache = stored;
      lastLocationIssue = null;
    }
  }

  if (!force && coordsCache !== undefined) {
    return Promise.resolve(coordsCache);
  }
  if (!force && coordsPromise) return coordsPromise;

  // force: muvaffaqiyatsiz null keshni tozalash; muvaffaqiyatli keshni saqlab
  // background yangilash mumkin — lekin force true bo'lsa qayta o'qiymiz.
  if (force) {
    coordsPromise = null;
  }

  coordsPromise = (async () => {
    // Desktop — brauzer (1 marta ruxsat, keyin maximumAge).
    if (isTelegramDesktopLike()) {
      const browser = await browserCoords(2500, false);
      if (browser) return rememberCoords(browser);
      lastLocationIssue = "other";
      coordsCache = null;
      return null;
    }

    // Mobil: asosan Telegram LocationManager (ruxsat 1 marta, doimiy).
    const tgResult = await requestTelegramLocation();
    if (tgResult.status === "ok") {
      return rememberCoords({ lat: tgResult.lat, lng: tgResult.lng });
    }

    if (tgResult.status === "device_off") lastLocationIssue = "device_off";
    else if (tgResult.status === "denied") lastLocationIssue = "denied";
    else lastLocationIssue = "other";

    // Brauzer fallback:
    // - Ruxsat rad emas
    // - Agar TG ruxsati bor → silent (qayta dialog YO'Q)
    // - Agar TG unsupported/error va hali ruxsat so'ralmagan → bir marta so'rash mumkin
    const tgGranted = isTelegramLocationGranted();
    if (tgResult.status !== "denied") {
      const silent = tgGranted || tgResult.status === "device_off";
      const browser = await browserCoords(silent ? 1200 : 2500, silent);
      if (browser) return rememberCoords(browser);
    }

    if (tgGranted && lastLocationIssue === "other") {
      lastLocationIssue = "device_off";
    }

    // Eski session kesh bo'lsa — yangilash muvaffaqiyatsiz bo'lsa ham ishlatamiz.
    const stale = readStoredCoords();
    if (stale) {
      coordsCache = stale;
      return stale;
    }

    coordsCache = null;
    return null;
  })().finally(() => {
    coordsPromise = null;
  });

  return coordsPromise;
}

/** GPS yoqib qaytganda — null keshni tashlab qayta o'qish (ruxsat qayta so'ralmaydi). */
export function retryCoordsIfPreviouslyFailed() {
  if (coordsCache === null) {
    coordsCache = undefined;
    coordsPromise = null;
  }
}

/** Checkout/UI: mavjud keshni olish (so'rovsiz). */
export function peekCoords(): Coords | null {
  if (coordsCache && typeof coordsCache === "object") return coordsCache;
  return readStoredCoords();
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // auth
  authTelegram: (init_data: string) =>
    req<{ token: { access_token: string }; user: User }>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ init_data }),
    }),
  updateMe: (data: Partial<Pick<User, "first_name" | "phone">>) =>
    req<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),

  // catalog
  restaurants: (q?: string) =>
    req<Restaurant[]>(`/restaurants${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  restaurant: (id: number) => req<RestaurantDetail>(`/restaurants/${id}`),

  // faol do'kon — joylashuv bo'lsa eng yaqin; bo'lmasa default.
  // Joylashuv hech qachon katalogni bloklamaydi.
  store: async (opts?: { forceCoords?: boolean }): Promise<RestaurantDetail | null> => {
    const loadDefault = () => req<RestaurantDetail>("/restaurants/default");

    const coords = await getCoords(!!opts?.forceCoords);
    if (coords) {
      try {
        return await req<RestaurantDetail>(
          `/restaurants/nearest?lat=${coords.lat}&lng=${coords.lng}`,
        );
      } catch (e) {
        try {
          return await loadDefault();
        } catch {
          if (e instanceof Error && e.message.includes("OUT_OF_RANGE")) {
            throw new OutOfRangeError();
          }
          throw e;
        }
      }
    }

    // GPS yo'q / o'chiq — baribir default do'konni ochamiz.
    return await loadDefault();
  },

  // addresses
  addresses: () => req<Address[]>("/addresses"),
  createAddress: (data: Partial<Address>) =>
    req<Address>("/addresses", { method: "POST", body: JSON.stringify(data) }),
  deleteAddress: (id: number) =>
    req<void>(`/addresses/${id}`, { method: "DELETE" }),

  // orders
  placeOrder: (data: unknown) =>
    req<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  myOrders: () => req<Order[]>("/orders"),
  order: (id: number) => req<Order>(`/orders/${id}`),
};
