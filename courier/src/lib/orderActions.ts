import type { OrderStatus } from "../types";

/** Admin biriktirgandan keyin, yo'lga chiqishdan oldin miqdor tahriri mumkin. */
const ADJUSTABLE_STATUSES = new Set<OrderStatus>([
  "accepted",
  "preparing",
  "ready",
]);

export function isAdjustableOrderStatus(status: OrderStatus): boolean {
  return ADJUSTABLE_STATUSES.has(status);
}
