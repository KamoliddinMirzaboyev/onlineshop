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
  // 1) SDK-provided value — present for most launch types.
  const fromSdk = tg?.initData;
  if (fromSdk) return fromSdk;

  // 2) SDK's own cache of the raw launch params — survives fragment cleanup
  //    and client-side navigation.
  try {
    const cached = sessionStorage.getItem("__telegram__initParams");
    if (cached) {
      const data = JSON.parse(cached)?.tgWebAppData;
      if (data) return data;
    }
  } catch {
    // sessionStorage may be blocked (private mode) — ignore.
  }

  // 3) Raw URL fragment / query — last resort before the router rewrites it.
  const raw = window.location.hash.slice(1) || window.location.search.slice(1);
  return new URLSearchParams(raw).get("tgWebAppData") ?? "";
}

export function initTelegram() {
  // Capture first, synchronously, before anything touches window.location.
  cachedInitData = readInitData();
  if (!tg) return;
  tg.ready();
  tg.expand();
  // Brand yashil — Telegram chrome (header / background) ham brandga mos.
  try {
    tg.setHeaderColor?.("#16A34A");
    tg.setBackgroundColor?.("#ffffff");
  } catch {
    // eski klientlar methodni qo'llab-quvvatlamasligi mumkin
  }
  // Mavzu (light/dark) endi Telegram klientidan emas — store/theme.ts orqali
  // ilovaning o'z holatidan boshqariladi (standart: light).
}

// initData string for backend HMAC auth. Empty in plain browser dev.
// Prefer the value captured at startup; re-read live if init hasn't run yet.
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

// Telegram'ning o'z joylashuv menejeri (Bot API 8.0+, eski klientlarda yo'q).
// Uch xil muvaffaqiyatsizlik sababini ajratamiz, chunki har biriga UI'da
// boshqacha javob kerak:
//  - "device_off": qurilmada GPS/joylashuv xizmati umuman o'chiq — buni hech
//    qanday veb/Telegram API orqali kod ichidan yoqib bo'lmaydi, faqat
//    qurilma sozlamalaridan (shu sabab openSettings() chaqiramiz).
//  - "denied": foydalanuvchi ilgari ruxsatni rad etgan — Telegram endi
//    o'zi qayta so'ramaydi, yana faqat sozlamalar orqali.
//  - "not_requested"/hali so'ralmagan holatda getLocation() Telegram'ning
//    o'z ICHKI (ilovadan chiqmaydigan) ruxsat oynasini ko'rsatadi — eng яхши holat.
export type TelegramLocationResult =
  | { status: "ok"; lat: number; lng: number }
  | { status: "unsupported" | "device_off" | "denied" | "error" };

/** Desktop/Web Telegram — LocationManager ishonchsiz yoki GPS yo'q. */
export function isTelegramDesktopLike(): boolean {
  const p = (tg?.platform ?? "").toLowerCase();
  return (
    p === "tdesktop" ||
    p === "macos" ||
    p === "web" ||
    p === "weba" ||
    p === "unigram" ||
    // platform bo'sh bo'lsa ham, oddiy brauzer (window.Telegram yo'q emas lekin
    // desktop WebView bo'lishi mumkin) — LocationManager'ga tayanmaymiz.
    (!p && typeof navigator !== "undefined" && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  );
}

export function requestTelegramLocation(): Promise<TelegramLocationResult> {
  const lm = tg?.LocationManager;
  if (!lm) return Promise.resolve({ status: "unsupported" });

  // Noutbuk / Telegram Desktop: LocationManager ko'pincha device_off yoki
  // callback bermaydi — brauzer geolocation'ga tezroq o'tish uchun skip.
  if (isTelegramDesktopLike()) {
    return Promise.resolve({ status: "unsupported" });
  }

  const attempt = new Promise<TelegramLocationResult>((resolve) => {
    // Har safar init() chaqiramiz (isInited bo'lsa ham) — isLocationAvailable
    // faqat init() ishga tushganda yangilanadi. Callback chaqirilmay qolish
    // xavfiga pastdagi timeout javob beradi.
    lm.init(() => {
      if (!lm.isLocationAvailable) {
        resolve({ status: "device_off" });
        return;
      }
      if (lm.isAccessRequested && !lm.isAccessGranted) {
        resolve({ status: "denied" });
        return;
      }
      lm.getLocation((loc) =>
        resolve(loc ? { status: "ok", lat: loc.latitude, lng: loc.longitude } : { status: "error" })
      );
    });
  });

  // https://github.com/Telegram-Mini-Apps/issues/issues/77
  return Promise.race([
    attempt,
    new Promise<TelegramLocationResult>((resolve) =>
      setTimeout(() => resolve({ status: "error" }), 3500)
    ),
  ]);
}

export function openTelegramLocationSettings() {
  tg?.LocationManager?.openSettings();
}

export const mainButton = tg?.MainButton;
export const backButton = tg?.BackButton;
