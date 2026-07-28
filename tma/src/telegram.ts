// Thin wrapper over the Telegram WebApp SDK with a browser fallback for local dev.

export const tg = window.Telegram?.WebApp;

// initData captured ONCE at startup, before BrowserRouter can rewrite the URL
// and drop the #tgWebAppData fragment. Empty string in plain-browser dev.
let cachedInitData = "";

/**
 * Read the signed launch params from every channel Telegram may use, keeping the
 * first non-empty result. Different launch entry points (menu/attachment button
 * vs a reply-keyboard `web_app` button) don't all populate `tg.initData`, so a
 * single-source read renders the user context empty for some of them.
 */
function readInitData(): string {
  const fromSdk = tg?.initData;
  if (fromSdk) return fromSdk;

  try {
    const cached = sessionStorage.getItem("__telegram__initParams");
    if (cached) {
      const data = JSON.parse(cached)?.tgWebAppData;
      if (data) return data;
    }
  } catch {
    /* ignore */
  }

  const raw = window.location.hash.slice(1) || window.location.search.slice(1);
  return new URLSearchParams(raw).get("tgWebAppData") ?? "";
}

/** LocationManager init bir marta — keyin isAccessGranted ishonchli bo'ladi. */
let locationManagerReady: Promise<boolean> | null = null;

export function ensureLocationManager(): Promise<boolean> {
  const lm = tg?.LocationManager;
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
  cachedInitData = readInitData();
  if (!tg) return;
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor?.("#16A34A");
    tg.setBackgroundColor?.("#ffffff");
  } catch {
    /* eski klient */
  }
  // Joylashuv ruxsatini ilova ochilishi bilan tayyorlash (keyin getLocation tez).
  void ensureLocationManager();
}

export function getInitData(): string {
  return cachedInitData || readInitData();
}

export function getLanguage(): "uz" | "ru" {
  const code = tg?.initDataUnsafe?.user?.language_code ?? "uz";
  return code.startsWith("ru") ? "ru" : "uz";
}

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  tg?.HapticFeedback?.impactOccurred(type);
}

export type TelegramLocationResult =
  | { status: "ok"; lat: number; lng: number }
  | { status: "unsupported" | "device_off" | "denied" | "error" };

export function isTelegramDesktopLike(): boolean {
  const p = (tg?.platform ?? "").toLowerCase();
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
  const lm = tg?.LocationManager;
  return !!(lm?.isAccessGranted);
}

/**
 * Telegram joylashuvi.
 * - Ruxsat yo'q → getLocation() bir marta so'raydi (Telegram prompt)
 * - Ruxsat bor → qayta prompt yo'q, faqat koordinata
 * - Rad etilgan → denied (openSettings kerak)
 */
export async function requestTelegramLocation(): Promise<TelegramLocationResult> {
  const lm = tg?.LocationManager;
  if (!lm || isTelegramDesktopLike()) {
    return { status: "unsupported" };
  }

  await ensureLocationManager();

  // Aniq rad — getLocation qayta dialog ochmaydi.
  if (lm.isAccessRequested && !lm.isAccessGranted) {
    return { status: "denied" };
  }

  // Ruxsat bor, GPS o'chiq — getLocation befoyda/sekin bo'lishi mumkin.
  if (lm.isAccessGranted && !lm.isLocationAvailable) {
    return { status: "device_off" };
  }

  const timeoutMs = lm.isAccessGranted ? 2500 : 8000;

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
        if (loc) {
          finish({ status: "ok", lat: loc.latitude, lng: loc.longitude });
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
  tg?.LocationManager?.openSettings();
}

export const mainButton = tg?.MainButton;
export const backButton = tg?.BackButton;
