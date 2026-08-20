import { get } from "../api";
import type { Order } from "../types";

/** #1 dan oldin #2+ yetkazmoqchi bo'lsa — yumshoq ogohlantirish. */
export function confirmOutOfOrder(
  target: Order,
  deliveringPool: Order[]
): boolean {
  const seq = target.route_sequence;
  if (seq == null || seq <= 1 || target.status !== "delivering") return true;
  const earlier = deliveringPool.filter(
    (o) =>
      o.status === "delivering" &&
      o.id !== target.id &&
      (o.route_sequence ?? 999) < seq
  );
  if (!earlier.length) return true;
  const first = earlier.reduce((a, b) =>
    (a.route_sequence ?? 999) <= (b.route_sequence ?? 999) ? a : b
  );
  return window.confirm(
    `Marshrut bo'yicha avval #${first.route_sequence} (№ ${first.number}) turadi.\n\n` +
      `Baribir № ${target.number} ni yetkazasizmi?`
  );
}

/** Yetkazgandan keyin keyingi stop navigatsiya taklif. Qolgan bor → true. */
export async function offerNextStop(): Promise<boolean> {
  try {
    const list = await get<Order[]>("/courier/orders");
    const nextList = list
      .filter((o) => o.status === "delivering")
      .sort(
        (a, b) => (a.route_sequence ?? 999) - (b.route_sequence ?? 999)
      );
    if (!nextList.length) return false;
    const next = nextList[0];
    const go = window.confirm(
      `Keyingi stop: #${next.route_sequence ?? 1} · № ${next.number}\n` +
        `${next.address_line}` +
        (next.route_leg_km != null
          ? `\n~${next.route_leg_km.toFixed(1)} km`
          : "") +
        `\n\nNavigatsiyani ochasizmi?`
    );
    if (go && next.lat != null && next.lng != null) {
      window.open(
        `https://yandex.com/maps/?rtext=~${next.lat},${next.lng}&rtt=auto`,
        "_blank"
      );
    }
    return true;
  } catch {
    return false;
  }
}
