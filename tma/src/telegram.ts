// Thin wrapper over the Telegram WebApp SDK with a browser fallback for local dev.

/** Live WebApp — har chaqiruvda window dan (import-time freeze yo'q). */
export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** Live binding: initTelegram() yangilaydi; effect/handler'da ham getWebApp() afzal. */
export let tg = getWebApp();

/** Bizning erta capture + SDK kesh. Redirect/hash yo'qolsa ham saqlanadi. */
const AF_INIT_KEY = "__af_tgWebAppData";

// initData captured ONCE at startup, before BrowserRouter can rewrite the URL
// and drop the #tgWebAppData fragment. Empty string in plain-browser dev.
let cachedInitData = "";

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.length > 0;
}

function persistInitData(data: string) {
  if (!isNonEmpty(data)) return;
  cachedInitData = data;
  try {
    sessionStorage.setItem(AF_INIT_KEY, data);
  } catch {
    /* private mode / blocked */
  }
}

function fromUrlParams(raw: string): string {
  if (!raw) return "";
  try {
    return new URLSearchParams(raw).get("tgWebAppData") ?? "";
  } catch {
    return "";
  }
}

/**
 * Read the signed launch params from every channel Telegram may use.
 * Tartib: live SDK → WebView.initParams → bizning kesh → TG sessionStorage → URL.
 */
function readInitData(): string {
  // 1) Live SDK (eng ishonchli — har doim window dan)
  const fromSdk = getWebApp()?.initData;
  if (isNonEmpty(fromSdk)) return fromSdk;

  // 2) Telegram WebView parse qilgan raw params (SDK ichki)
  try {
    const webView = (
      window as Window & {
        Telegram?: { WebView?: { initParams?: { tgWebAppData?: string } } };
      }
    ).Telegram?.WebView?.initParams?.tgWebAppData;
    if (isNonEmpty(webView)) return webView;
  } catch {
    /* ignore */
  }

  // 3) Bizning erta inline capture / oldingi muvaffaqiyatli o'qish
  try {
    const ours = sessionStorage.getItem(AF_INIT_KEY);
    if (isNonEmpty(ours)) return ours;
  } catch {
    /* ignore */
  }

  // 4) Rasmiy SDK sessionStorage kesh (hash tozalangandan keyin)
  try {
    const cached = sessionStorage.getItem("__telegram__initParams");
    if (cached) {
      const data = JSON.parse(cached)?.tgWebAppData;
      if (isNonEmpty(data)) return data;
    }
  } catch {
    /* ignore */
  }

  // 5) URL hash yoki query (oxirgi chora)
  const fromHash = fromUrlParams(window.location.hash.slice(1));
  if (isNonEmpty(fromHash)) return fromHash;
  return fromUrlParams(window.location.search.slice(1));
}

/** LocationManager init bir marta — keyin isAccessGranted ishonchli bo'ladi. */
let locationManagerReady: Promise<boolean> | null = null;

export function ensureLocationManager(): Promise<boolean> {
  const lm = getWebApp()?.LocationManager;
  if (!lm) return Promise.resolve(false);
  if (isTelegramDesktopLike()) return Promise.resolve(false);
  if (lm.isInited) return Promise.resolve(true);
  if (locationManagerReady) return locationManagerReady;

  locationManagerReady = new Promise<boolean>((resolve) => {
    const t = window.setTimeout(() => resolve(lm.isInited), 2000);
    try {
      lm.init(() => {
        window.clearTimeout(t);
        resolve(true);
      });
    } catch {
      window.clearTimeout(t);
      resolve(false);
    }
  });
  return locationManagerReady;
}

export function initTelegram() {
  tg = getWebApp();
  // Capture birinchi, synchronous — location o'zgarmasdan oldin.
  const data = readInitData();
  if (data) persistInitData(data);

  if (!tg) return;
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor?.("#16A34A");
    tg.setBackgroundColor?.("#ffffff");
  } catch {
    /* eski klient */
  }
  // ready() dan keyin ba'zi klientlar initData ni to'ldiradi — qayta o'qi.
  const again = readInitData();
  if (again) persistInitData(again);

  void ensureLocationManager();
}

export function getInitData(): string {
  if (isNonEmpty(cachedInitData)) return cachedInitData;
  const data = readInitData();
  if (data) persistInitData(data);
  return data || cachedInitData || "";
}

export function getLanguage(): "uz" | "ru" {
  const code = getWebApp()?.initDataUnsafe?.user?.language_code ?? "uz";
  return code.startsWith("ru") ? "ru" : "uz";
}

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  getWebApp()?.HapticFeedback?.impactOccurred(type);
}

export type TelegramLocationResult =
  | { status: "ok"; lat: number; lng: number; accuracyM?: number }
  | { status: "unsupported" | "device_off" | "denied" | "error" };

export function isTelegramDesktopLike(): boolean {
  const p = (getWebApp()?.platform ?? "").toLowerCase();
  return (
    p === "tdesktop" ||
    p === "macos" ||
    p === "web" ||
    p === "weba" ||
    p === "unigram" ||
    (!p && typeof navigator !== "undefined" && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );
}

export function isTelegramLocationGranted(): boolean {
  const lm = getWebApp()?.LocationManager;
  return !!(lm?.isAccessGranted);
}

export type TelegramLocationOpts = {
  /** Kutish (ms). Checkout uchun uzunasiga — sekin GPS ham chiqsin. */
  timeoutMs?: number;
  /** true: isLocationAvailable=false bo'lsa ham getLocation urinadi (ba'zi klientlar). */
  requireFresh?: boolean;
};

/**
 * Telegram joylashuvi.
 * - Ruxsat yo'q → getLocation() bir marta so'raydi (Telegram prompt)
 * - Ruxsat bor → qayta prompt yo'q, faqat koordinata
 * - Rad etilgan → denied (openSettings kerak)
 */
export async function requestTelegramLocation(
  opts: TelegramLocationOpts = {},
): Promise<TelegramLocationResult> {
  const lm = getWebApp()?.LocationManager;
  if (!lm || isTelegramDesktopLike()) {
    return { status: "unsupported" };
  }

  await ensureLocationManager();

  // Aniq rad — getLocation qayta dialog ochmaydi.
  if (lm.isAccessRequested && !lm.isAccessGranted) {
    return { status: "denied" };
  }

  // Ruxsat bor, GPS o'chiq — getLocation befoyda/sekin bo'lishi mumkin.
  // requireFresh: baribir urinish (ba'zi TG versiyalarida isLocationAvailable yolg'on negative).
  if (lm.isAccessGranted && !lm.isLocationAvailable && !opts.requireFresh) {
    return { status: "device_off" };
  }

  const timeoutMs =
    opts.timeoutMs ?? (lm.isAccessGranted ? 5_000 : 10_000);

  return new Promise<TelegramLocationResult>((resolve) => {
    let done = false;
    const finish = (r: TelegramLocationResult) => {
      if (done) return;
      done = true;
      resolve(r);
    };

    const timer = window.setTimeout(() => {
      // Ruxsat berilgan lekin timeout → GPS sekin/o'chiq
      if (lm.isAccessGranted) finish({ status: "device_off" });
      else finish({ status: "error" });
    }, timeoutMs);

    try {
      // getLocation: ruxsat yo'q bo'lsa Telegram prompt; bor bo'lsa jim o'qiydi.
      lm.getLocation((loc) => {
        window.clearTimeout(timer);
        if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
          const acc =
            typeof loc.horizontal_accuracy === "number" && loc.horizontal_accuracy > 0
              ? loc.horizontal_accuracy
              : undefined;
          finish({
            status: "ok",
            lat: loc.latitude,
            lng: loc.longitude,
            accuracyM: acc,
          });
          return;
        }
        if (lm.isAccessGranted) {
          finish({ status: "device_off" });
          return;
        }
        if (lm.isAccessRequested && !lm.isAccessGranted) {
          finish({ status: "denied" });
          return;
        }
        finish({ status: "error" });
      });
    } catch {
      window.clearTimeout(timer);
      finish({ status: "error" });
    }
  });
}

export function openTelegramLocationSettings() {
  getWebApp()?.LocationManager?.openSettings();
}

export const mainButton = getWebApp()?.MainButton;
export const backButton = getWebApp()?.BackButton;
