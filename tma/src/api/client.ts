import {
  isTelegramDesktopLike,
  isTelegramLocationGranted,
  requestTelegramLocation,
} from "../telegram";
import type { Address, Order, Restaurant, RestaurantDetail, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "https://api.barakali-bozor.uz/api";

export class OutOfRangeError extends Error {}
export class LocationDeniedError extends Error {}

let token: string | null = localStorage.getItem("af_token");

export function setToken(t: string) {
  token = t;
  localStorage.setItem("af_token", t);
}

export function clearToken() {
  token = null;
  try {
    localStorage.removeItem("af_token");
  } catch {
    /* ignore */
  }
}

const FETCH_TIMEOUT_MS = 15_000;
/** 401 da bir marta qayta-auth (tsikl oldini olish). */
let reauthInFlight: Promise<boolean> | null = null;

async function tryReauth(): Promise<boolean> {
  if (reauthInFlight) return reauthInFlight;
  reauthInFlight = (async () => {
    try {
      const { getInitData } = await import("../telegram");
      const initData = getInitData();
      // initData yo'q bo'lsa tokenni o'chirmaymiz — boshqa so'rov /me bilan
      // hali ishlashi mumkin; faqat Telegram qayta-auth imkonsiz.
      if (!initData) return false;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${BASE}/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init_data: initData }),
          signal: controller.signal,
        });
        if (!res.ok) {
          clearToken();
          return false;
        }
        const body = (await res.json()) as { token: { access_token: string } };
        setToken(body.token.access_token);
        return true;
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      clearToken();
      return false;
    } finally {
      reauthInFlight = null;
    }
  })();
  return reauthInFlight;
}

// ── Joylashuv kesh (sessiya + xotira) ─────────────────────────────
// Katalog (do'kon tanlash) uchun qisqa kesh OK.
// Checkout: force + highAccuracy — eski kesh yuborilmasin.
const COORDS_SS_KEY = "af_coords_v2";
const ADDR_SS_KEY = "af_addr_v2";
const COORDS_TTL_MS = 3 * 60 * 1000; // 3 daqiqa (ilgari 30 — eski joy yuborilardi)

export type Coords = {
  lat: number;
  lng: number;
  /** GPS xatosi (m), kichikroq = aniqroq */
  accuracyM?: number;
  /** qachon olingan (ms epoch) */
  at?: number;
};

export type GetCoordsOpts = {
  /** true: keshni e'tiborsiz qoldirib qayta o'qiydi; muvaffaqiyatsizda eski kesh QAYTMASIN */
  force?: boolean;
  /** true: GPS yuqori aniqlik (checkout/buyurtma) — sekinroq, lekin aniq */
  highAccuracy?: boolean;
  /** true: foydalanuvchi ochiq harakati — TG + brauzer ruxsat oynasini darhol ochamiz */
  prompt?: boolean;
};

/** Bundan yomon aniqlik → qisqa ikkinchi urinish (submit chegarasi bilan bir xil). */
const MAX_ACCEPT_ACCURACY_M = 100;
/** Ideal GPS (bino darajasi) */
const GOOD_ACCURACY_M = 25;

let coordsCache: Coords | null | undefined;
let coordsPromise: Promise<Coords | null> | null = null;
/** highAccuracy (checkout/xarita) so'rovi uchun alohida dedupe — parallel chaqiruvlar bitta GPS sessiyasini bo'lishadi. */
let hiAccPromise: Promise<Coords | null> | null = null;

export type LocationIssue = "device_off" | "denied" | "other" | "slow";
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

function clearStoredCoords() {
  try {
    sessionStorage.removeItem(COORDS_SS_KEY);
  } catch {
    /* ignore */
  }
}

function rememberCoords(c: Coords): Coords {
  lastLocationIssue = null;
  const full: Coords = { ...c, at: c.at ?? Date.now() };
  coordsCache = full;
  writeStoredCoords(full);
  return full;
}

/** Ikki nuqtadan aniqroqini tanlash (accuracyM kichik g'olib). */
function pickBest(a: Coords | null, b: Coords | null): Coords | null {
  if (!a) return b;
  if (!b) return a;
  const aa = a.accuracyM ?? 9999;
  const ba = b.accuracyM ?? 9999;
  return aa <= ba ? a : b;
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

export function clearAddressLabel() {
  try {
    sessionStorage.removeItem(ADDR_SS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Brauzer geolocation.
 * @param silent true — ruxsat dialogi ochilmasin (faqat kesh/maximumAge).
 */
function browserCoords(
  timeoutMs: number,
  silent: boolean,
  highAccuracy: boolean,
  /** navigator.permissions yo'q bo'lsa ham jim urinish (iOS TG WebView, ruxsat allaqachon bor). */
  allowNoPerms = false,
): Promise<Coords | null> {
  if (!navigator.geolocation) return Promise.resolve(null);

  const run = (): Promise<Coords | null> =>
    new Promise((resolve) => {
      let done = false;
      const finish = (v: Coords | null) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      const timer = window.setTimeout(() => finish(null), timeoutMs + 300);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(timer);
          const acc = pos.coords.accuracy;
          finish({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: typeof acc === "number" && acc > 0 ? acc : undefined,
            at: Date.now(),
          });
        },
        () => {
          window.clearTimeout(timer);
          finish(null);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          // Checkout: yangi fix (maximumAge:0); katalog: qisqa kesh.
          maximumAge: highAccuracy ? 0 : silent ? 60_000 : 120_000,
        },
      );
    });

  if (silent && navigator.permissions?.query) {
    return navigator.permissions
      .query({ name: "geolocation" })
      .then((st) => (st.state === "granted" || allowNoPerms ? run() : null))
      .catch(() => (allowNoPerms ? run() : null));
  }
  if (silent) return allowNoPerms ? run() : Promise.resolve(null);
  return run();
}

/**
 * Brauzer watchPosition — bir necha sekund ichida eng aniq fixni oladi.
 * getCurrentPosition ba'zan eski/wifi fix qaytaradi.
 */
function watchBestBrowserCoords(
  windowMs: number,
  silent: boolean,
  allowNoPerms = false,
): Promise<Coords | null> {
  if (!navigator.geolocation) return Promise.resolve(null);

  const run = (): Promise<Coords | null> => new Promise((resolve) => {
    let best: Coords | null = null;
    let watchId = -1;
    const done = () => {
      if (watchId >= 0) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          /* ignore */
        }
      }
      resolve(best);
    };
    const timer = window.setTimeout(done, windowMs);
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = pos.coords.accuracy;
          const c: Coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: typeof acc === "number" && acc > 0 ? acc : undefined,
            at: Date.now(),
          };
          best = pickBest(best, c);
          // Yetarli aniq — darhol to'xtatish
          if (c.accuracyM != null && c.accuracyM <= GOOD_ACCURACY_M) {
            window.clearTimeout(timer);
            done();
          }
        },
        () => {
          /* xato — timer tugaguncha kutamiz */
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: windowMs },
      );
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });

  // Ruxsat hali so'ralmagan bo'lsa, watchPosition ham OS dialogini ochadi —
  // Telegram LocationManager promptidan alohida ikkinchi prompt paydo bo'ladi.
  // Silent rejimda faqat ruxsat allaqachon berilgan bo'lsa ishga tushiramiz.
  if (silent && navigator.permissions?.query) {
    return navigator.permissions
      .query({ name: "geolocation" })
      .then((st) => (st.state === "granted" || allowNoPerms ? run() : null))
      .catch(() => (allowNoPerms ? run() : null));
  }
  if (silent) return allowNoPerms ? run() : Promise.resolve(null);
  return run();
}

/**
 * Yuqori aniqlik: Telegram + brauzer GPS + watch multi-sample.
 * Eng kichik accuracyM g'olib.
 */
async function fetchHighAccuracyCoords(promptNow = false): Promise<Coords | null> {
  const desktop = isTelegramDesktopLike();
  // TG'dan kelgan oxirgi sabab — fix bo'lmasa checkout aniq xabar bersin.
  let tgStatus: string | null = null;

  /**
   * @param promptBrowser true — brauzerning o'z ruxsat oynasini ochamiz
   *   (TG LocationManager bermaganda oxirgi chora).
   */
  const attempt = async (
    budgetMs: number,
    doPrompt: boolean,
  ): Promise<Coords | null> => {
    // doPrompt — foydalanuvchi so'radi: TG + brauzer ruxsat oynasini ochamiz.
    // Aks holda jim: ruxsat berilgan bo'lsagina o'qiymiz, prompt chiqarmaymiz.
    const granted = isTelegramLocationGranted(); // 1-urinishda o'zgargan bo'lishi mumkin
    const silentBrowser = !desktop && !doPrompt;
    const allowNoPerms = desktop || doPrompt || granted;

    const tgP = desktop
      ? Promise.resolve(null as Coords | null)
      : requestTelegramLocation({
          timeoutMs: budgetMs,
          requireFresh: doPrompt || granted,
        }).then((r) => {
          tgStatus = r.status;
          return r.status === "ok"
            ? {
                lat: r.lat,
                lng: r.lng,
                accuracyM: r.accuracyM,
                at: Date.now(),
              }
            : null;
        });

    // Parallel: bitta getCurrentPosition + qisqa watch (eng aniq)
    const browserP = Promise.all([
      browserCoords(budgetMs, silentBrowser, true, allowNoPerms),
      watchBestBrowserCoords(desktop ? 5000 : 4000, silentBrowser, allowNoPerms),
    ]).then(([a, b]) => pickBest(a, b));

    const [tg, browser] = await Promise.all([tgP, browserP]);
    return pickBest(tg, browser);
  };

  // 1-urinish: promptNow bo'lsa ruxsat oynalari; aks holda jim.
  let best = await attempt(12_000, promptNow);
  // 2-urinish: GPS isishi uchun — har doim jim (yangi prompt chiqarmaymiz).
  if (!best || (best.accuracyM != null && best.accuracyM > MAX_ACCEPT_ACCURACY_M)) {
    best = pickBest(best, await attempt(7_000, false));
  }

  if (!best) {
    if (tgStatus === "device_off") lastLocationIssue = "device_off";
    else if (tgStatus === "slow") lastLocationIssue = "slow";
    else if (tgStatus === "denied") {
      // TG "denied" ishonchsiz — yopilgan/javobsiz prompt ham shunday bo'ladi.
      // Faqat brauzer permissions APIsi aniq "denied" desa — haqiqiy rad.
      // Aks holda "other" qoldiramiz: "Qayta aniqlash" tugmasi promptni qayta ko'rsatadi.
      let hardDenied = false;
      try {
        const p = await navigator.permissions?.query({
          name: "geolocation" as PermissionName,
        });
        hardDenied = p?.state === "denied";
      } catch {
        /* permissions API yo'q (iOS TG WebView) — rad deb hisoblamaymiz */
      }
      lastLocationIssue = hardDenied ? "denied" : "other";
    }
  }
  return best;
}

/**
 * Joylashuv olish.
 * - force: yangi GPS (kesh emas); muvaffaqiyatsiz → null (eski joy QAYTMASIN)
 * - highAccuracy: checkout/buyurtma uchun aniqroq
 */
export function getCoords(
  forceOrOpts: boolean | GetCoordsOpts = false,
): Promise<Coords | null> {
  const opts: GetCoordsOpts =
    typeof forceOrOpts === "boolean" ? { force: forceOrOpts } : forceOrOpts;
  const force = !!opts.force;
  const highAccuracy = !!opts.highAccuracy;

  // Parallel highAccuracy chaqiruvlar bitta GPS sessiyasini bo'lishadi — lekin
  // foydalanuvchi "ruxsat berish" bossa (prompt) yangi, oynali sessiya boshlaymiz.
  if (highAccuracy && hiAccPromise && !opts.prompt) return hiAccPromise;

  if (coordsCache === undefined && !force) {
    const stored = readStoredCoords();
    if (stored) {
      coordsCache = stored;
      lastLocationIssue = null;
    }
  }

  // Faqat past aniqlik + force yo'q: kesh ishlatish mumkin.
  if (!force && !highAccuracy && coordsCache !== undefined) {
    return Promise.resolve(coordsCache);
  }
  if (!force && !highAccuracy && coordsPromise) return coordsPromise;

  // force wipe'idan oldingi yaqin fix — GPS bir zumga uzilsa null o'rniga shuni beramiz.
  let recentFix: Coords | null = null;
  if (force) {
    recentFix = peekCoords();
    coordsPromise = null;
    coordsCache = undefined;
    clearStoredCoords();
  }

  const run = (async () => {
    // ── Checkout / buyurtma: yuqori aniqlik, parallel manbalar ──
    // Diqqat: faqat highAccuracy shu og'ir yo'lni tanlaydi. `force` yolg'iz —
    // faqat eski keshni yubormaslik degani (nearest-store uchun tezlik yetarli).
    if (highAccuracy) {
      lastLocationIssue = null;
      const best = await fetchHighAccuracyCoords(!!opts.prompt);
      if (best) return rememberCoords(best);

      // Ruxsat rad etilgan bo'lsa eski joyni ham qaytarmaymiz (foydalanuvchi
      // sozlamaga yo'naltirilsin). Aks holda yaqin (≤3 daq) fix null'dan yaxshi.
      if (
        lastLocationIssue !== "denied" &&
        recentFix &&
        (recentFix.at == null || Date.now() - recentFix.at < COORDS_TTL_MS)
      ) {
        return rememberCoords(recentFix);
      }

      // fetchHighAccuracyCoords aniq sabab (denied/device_off/slow) qo'ymagan bo'lsa.
      if (lastLocationIssue == null) {
        lastLocationIssue = isTelegramLocationGranted() ? "device_off" : "other";
      }
      if (!force) coordsCache = null;
      return null; // eski kesh QAYTMASIN
    }

    const tgTimeout = 4_000;
    const browserTimeout = 2_500;

    // Desktop — brauzer.
    if (isTelegramDesktopLike()) {
      const browser = await browserCoords(browserTimeout, false, false);
      if (browser) return rememberCoords(browser);
      lastLocationIssue = "other";
      coordsCache = null;
      return null;
    }

    // Mobil katalog: Telegram LocationManager (tez, past aniqlik OK).
    const tgResult = await requestTelegramLocation({
      timeoutMs: tgTimeout,
      requireFresh: false,
    });
    if (tgResult.status === "ok") {
      return rememberCoords({
        lat: tgResult.lat,
        lng: tgResult.lng,
        accuracyM: tgResult.accuracyM,
      });
    }

    if (tgResult.status === "device_off") lastLocationIssue = "device_off";
    else if (tgResult.status === "denied") lastLocationIssue = "denied";
    else if (tgResult.status === "slow") lastLocationIssue = "slow";
    else lastLocationIssue = "other";

    const tgGranted = isTelegramLocationGranted();
    if (tgResult.status !== "denied") {
      const silent = tgGranted || tgResult.status === "device_off";
      const browser = await browserCoords(silent ? 1_500 : 2_500, silent, false);
      if (browser) return rememberCoords(browser);
    }

    if (tgGranted && lastLocationIssue === "other") {
      lastLocationIssue = "device_off";
    }

    const stale = readStoredCoords();
    if (stale) {
      coordsCache = stale;
      return stale;
    }

    coordsCache = null;
    return null;
  })();

  if (highAccuracy) {
    hiAccPromise = run.finally(() => {
      hiAccPromise = null;
    });
    return hiAccPromise;
  }

  if (!force && !highAccuracy) {
    coordsPromise = run.finally(() => {
      coordsPromise = null;
    });
    return coordsPromise;
  }

  return run;
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

async function req<T>(
  path: string,
  opts: RequestInit = {},
  _retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // Caller signal + timeout birlashtirish
  const external = opts.signal;
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Tarmoq vaqti tugadi. Qayta urinib ko'ring.");
    }
    throw new Error("Tarmoq xatosi. Internetni tekshiring.");
  } finally {
    window.clearTimeout(timer);
  }

  if (res.status === 401 && !_retried && !path.startsWith("/auth/")) {
    const ok = await tryReauth();
    if (ok) return req<T>(path, opts, true);
  }

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
  /** Mavjud JWT bilan foydalanuvchi — initData yo'q sessiya restore. */
  me: () => req<User>("/auth/me"),
  updateMe: (data: Partial<Pick<User, "first_name" | "phone">>) =>
    req<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),

  // catalog
  restaurants: (q?: string) =>
    req<Restaurant[]>(`/restaurants${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  restaurant: (id: number) => req<RestaurantDetail>(`/restaurants/${id}`),

  /** Nuqta yetkazish hududida-yo'qligini tekshirish. OUT_OF_RANGE → 404 (xato). */
  nearest: (lat: number, lng: number) =>
    req<RestaurantDetail>(`/restaurants/nearest?lat=${lat}&lng=${lng}`),

  // faol do'kon — joylashuv bo'lsa eng yaqin; OUT_OF_RANGE yutilmaydi.
  // GPS yo'q — default do'kon (katalog ochiq qoladi).
  store: async (opts?: { forceCoords?: boolean }): Promise<RestaurantDetail | null> => {
    const loadDefault = () => req<RestaurantDetail>("/restaurants/default");

    const coords = await getCoords(!!opts?.forceCoords);
    if (coords) {
      try {
        return await req<RestaurantDetail>(
          `/restaurants/nearest?lat=${coords.lat}&lng=${coords.lng}`,
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes("OUT_OF_RANGE")) {
          throw new OutOfRangeError();
        }
        // Tarmoq/server xatosi — default fallback (hudud emas).
        try {
          return await loadDefault();
        } catch {
          throw e;
        }
      }
    }

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
