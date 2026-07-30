import { get, post } from "./api";

export interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

export const ORDER_ALERT_SOUND_URL = "/order-alert.wav";

type PushHandler = (p: PushPayload) => void;
const pushHandlers = new Set<PushHandler>();
let messageWired = false;
let swRegisterPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Subscribe to push payloads the service worker forwards while the app is open.
 */
export function onPushMessage(cb: PushHandler): () => void {
  pushHandlers.add(cb);
  if (!messageWired && "serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      if (e.data && e.data.type === "push") {
        pushHandlers.forEach((h) => h(e.data.payload as PushPayload));
      }
    });
    messageWired = true;
  }
  return () => pushHandlers.delete(cb);
}

export function playOrderAlertSound(): void {
  if (typeof Audio === "undefined") return;
  const audio = new Audio(ORDER_ALERT_SOUND_URL);
  audio.volume = 1;
  audio.play().catch(() => {
    /* autoplay policy */
  });
}

/** OS / SW orqali bildirishnoma (tab yopiq yoki background). */
export async function showOrderNotification(
  title: string,
  body: string,
  opts?: { url?: string; tag?: string },
): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const tag = opts?.tag || `order-${Date.now()}`;
  const url = opts?.url || "/orders";

  try {
    const reg = await ensureRegistration();
    if (reg) {
      const opts: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: { url },
      };
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    // Fallback without SW
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      tag,
      requireInteraction: true,
      data: { url },
    });
  } catch {
    /* ignore */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function notifPermission(): NotificationPermission {
  return "Notification" in window ? Notification.permission : "denied";
}

/** SW ni erta ro'yxatdan o'tkazish (main.tsx dan). */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!swRegisterPromise) {
    swRegisterPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        // Yangilanishni darhol qo'llash
        await reg.update().catch(() => {});
        return reg;
      })
      .catch(() => null);
  }
  return swRegisterPromise;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await registerServiceWorker();
  if (!reg) return null;
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  } catch {
    /* ignore */
  }
  return (await navigator.serviceWorker.getRegistration()) ?? reg;
}

/**
 * Ruxsat + PushManager subscribe + backendga yozish.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";

  await registerServiceWorker();

  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm !== "granted") return perm;

  const reg = await ensureRegistration();
  if (!reg?.pushManager) throw new Error("Service worker tayyor emas");

  const { public_key } = await get<{ public_key: string }>("/courier/push/public-key");
  if (!public_key) throw new Error("Push kaliti olinmadi (VAPID)");

  let sub = await reg.pushManager.getSubscription();
  // Kalit o'zgargan bo'lsa qayta subscribe
  if (sub) {
    try {
      await post("/courier/push/subscribe", sub.toJSON());
      return "granted";
    } catch {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }

  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(public_key).buffer as ArrayBuffer,
  });
  await post("/courier/push/subscribe", sub.toJSON());
  return "granted";
}

/** Login/restart: granted bo'lsa qayta yozish; default bo'lsa ruxsat so'rash. */
export async function syncPush(): Promise<NotificationPermission | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  try {
    if (Notification.permission === "denied") return "denied";
    return await enablePush();
  } catch {
    return notifPermission();
  }
}

/** Backend orqali test push. */
export async function testPush(): Promise<void> {
  await post("/courier/push/test", {});
}
