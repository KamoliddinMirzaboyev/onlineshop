import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { get } from "../api";
import { useResource } from "../lib/cache";
import { pageVariants } from "../lib/motion";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import { playOrderAlertSound, showOrderNotification } from "../push";
import { useOrderAlerts } from "../store";
import type { Order } from "../types";
import BottomNav from "./BottomNav";
import { useToast } from "./Toast";

/** Butun ilova bo'yicha bitta joyda buyurtmalarni pollab, yangi (hali hech
    kimga biriktirilmagan) buyurtma chiqqanda ovoz + OS bildirishnoma + toast. */
function useNewOrderAlerts() {
  const setAvailableCount = useOrderAlerts((s) => s.setAvailableCount);
  const toast = useToast();
  const { data, refresh } = useResource<Order[]>(
    "courier_orders",
    () => get<Order[]>("/courier/orders"),
    { pollMs: 12000 },
  );
  const seenIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!data) return;
    const available = data.filter(
      (o) => o.assigned_courier_id == null && isAcceptableOrderStatus(o.status),
    );
    setAvailableCount(available.length);

    const ids = new Set(available.map((o) => o.id));
    if (seenIds.current) {
      const fresh = available.filter((o) => !seenIds.current!.has(o.id));
      if (fresh.length > 0) {
        const title =
          fresh.length === 1
            ? `Yangi buyurtma № ${fresh[0].number}`
            : `${fresh.length} ta yangi buyurtma`;
        const body =
          fresh.length === 1
            ? fresh[0].address_line
            : "Yangi buyurtmalarni ko'rish uchun oching";
        playOrderAlertSound();
        void showOrderNotification(title, body, {
          url: "/orders",
          tag: `neworder-${fresh[0].id}`,
        });
        toast.show({
          type: "push",
          title,
          body,
          url: "/orders",
          duration: 10000,
        });
      }
    }
    seenIds.current = ids;
  }, [data, setAvailableCount, toast]);

  useEffect(() => {
    const baseURL = import.meta.env.VITE_API_URL ?? "https://allfoodapi.webportfolio.uz/api";
    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (closed) return;
      try {
        // To'liq JWT o'rniga qisqa muddatli SSE ticket (query string xavfini kamaytiradi).
        const ticket = await get<{ token: string }>("/courier/stream-ticket");
        if (closed) return;
        es?.close();
        es = new EventSource(`${baseURL}/courier/stream?token=${encodeURIComponent(ticket.token)}`);
        es.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { type?: string };
            if (payload.type === "orders_updated") {
              refresh();
              window.dispatchEvent(new Event("courier-push"));
            }
          } catch {
            /* ignore malformed keepalive/noise */
          }
        };
        es.onerror = () => {
          es?.close();
          es = null;
          if (!closed) {
            retryTimer = setTimeout(connect, 3000);
          }
        };
      } catch {
        if (!closed) {
          retryTimer = setTimeout(connect, 5000);
        }
      }
    };

    void connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [refresh]);
}

/** Tab sahifalar uchun: kontent + pastki navigatsiya. Tablar almashganda
    sahifa silliq o'tadi (AnimatePresence). */
export default function Layout() {
  const location = useLocation();
  useNewOrderAlerts();
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto pb-20">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
}
