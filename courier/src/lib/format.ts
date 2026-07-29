import type { OrderStatus, PaymentMethod } from "../types";

export const money = (n: number) =>
  n.toLocaleString("ru-RU").replace(/,/g, " ");

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });

export const STATUS_LABEL: Record<string, string> = {
  pending: "Yangi",
  confirmed: "Tasdiqlangan",
  preparing: "Tayyorlanmoqda",
  ready: "Tayyor",
  accepted: "Qabul qilindi",
  delivering: "Yetkazilmoqda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

export const STATUS_PILL: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  confirmed: "bg-amber-100 text-amber-700",
  preparing: "bg-orange-100 text-orange-700",
  ready: "bg-violet-100 text-violet-700",
  accepted: "bg-cyan-100 text-cyan-700",
  delivering: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export const statusLabel = (s: OrderStatus) => STATUS_LABEL[s] ?? s;
export const statusPill = (s: OrderStatus) =>
  STATUS_PILL[s] ?? "bg-slate-100 text-slate-600";

export const PAYMENT_LABEL: Record<string, string> = {
  cash: "Naqd",
  payme: "Payme",
  click: "Click",
  uzum: "Uzum",
};

export const paymentLabel = (m?: PaymentMethod) =>
  m ? PAYMENT_LABEL[m] ?? m : "—";

/** Google Maps navigatsiya havolasi (lat/lng bo'lsa). */
export const mapsUrl = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

/** Miqdor + o'lchov birligi: "1 kg", "3 dona". */
export const qtyUnit = (quantity: number, unit?: string | null) =>
  `${quantity} ${unit || "dona"}`;

/** Masofa: "4.2 km" / "850 m". */
export const distanceLabel = (km?: number | null) => {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

/** ETA: "~25 daqiqa". */
export const etaLabel = (minutes?: number | null) =>
  minutes ? `~${minutes} daqiqa` : null;

/** Ko'p manzilli marshrut (Yandex Maps uchun) - barcha faol buyurtmalarni birga ko'rish. */
export const multiRouteUrl = (coords: { lat: number; lng: number }[]) => {
  if (!coords || coords.length === 0) return null;
  const path = coords.map((c) => `${c.lat},${c.lng}`).join("~");
  return `https://yandex.uz/maps/?rtext=~${path}`;
};
