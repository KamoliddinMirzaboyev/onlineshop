import { get, post } from "./api";

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

export function notifPermission(): NotificationPermission {
  return pushSupported() ? Notification.permission : "denied";
}

/** serviceWorker.ready can hang forever if the SW never activates — race it with a timeout. */
function serviceWorkerReady(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker tayyor bo'lmadi")), timeoutMs),
    ),
  ]);
}

/**
 * Request permission, subscribe via PushManager, register subscription with the backend.
 * May throw — callers should surface the error to the user.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;

  const reg = await serviceWorkerReady();
  const { public_key } = await get<{ public_key: string }>("/admin/push/public-key");
  if (!public_key) throw new Error("Push kaliti olinmadi");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key).buffer as ArrayBuffer,
    });
  }
  await post("/admin/push/subscribe", sub.toJSON());
  return "granted";
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await serviceWorkerReady();
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
