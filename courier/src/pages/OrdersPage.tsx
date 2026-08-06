import { Bike, Clock, MapPin, Navigation, Phone } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, patch, post } from "../api";
import PageHeader from "../components/PageHeader";
import { ListSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import {
  etaLabel,
  money,
  orderDistanceLabel,
  qtyUnit,
  statusLabel,
  statusPill,
} from "../lib/format";
import { confirmOutOfOrder, offerNextStop } from "../lib/routeFlow";
import { getCurrentCoords } from "../location";
import type { Order, OrderStatus } from "../types";

const POLL_INTERVAL_MS = 20000;

export default function OrdersPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [updating, setUpdating] = useState<number | null>(null);

  const { data, loading, refreshing, error, refresh } = useResource<Order[]>(
    "courier_orders",
    () => get<Order[]>("/courier/orders"),
    { pollMs: POLL_INTERVAL_MS, errorText: "Buyurtmalarni yangilab bo'lmadi. Internetni tekshiring." }
  );
  const orders = data ?? [];

  useEffect(() => {
    const onPush = () => refresh();
    window.addEventListener("courier-push", onPush);
    return () => window.removeEventListener("courier-push", onPush);
  }, [refresh]);

  const withGps = async (extra: Record<string, unknown> = {}) => {
    const pos = await getCurrentCoords();
    if (pos) return { ...extra, lat: pos.lat, lng: pos.lng };
    return extra;
  };

  const setStatus = async (id: number, status: OrderStatus) => {
    setUpdating(id);
    try {
      if (status === "delivering") {
        const body = await withGps({ order_ids: null });
        const res = await post<{
          total_distance_km: number;
          orders: Order[];
        }>("/courier/route/start", body);
        const n = res.orders?.length ?? 1;
        const km =
          typeof res.total_distance_km === "number"
            ? ` · ~${res.total_distance_km.toFixed(1)} km`
            : "";
        toast.success(
          n > 1
            ? `Marshrut tuzildi 🛵 — ${n} ta stop${km}`
            : `Yetkazish boshlandi 🛵${km}`
        );
      } else {
        await patch(`/courier/orders/${id}`, { status });
        toast.success("Buyurtma qabul qilindi ✅");
      }
      refresh();
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(null);
    }
  };

  const startRoute = async (includeIntoActive = false) => {
    const accepted = orders.filter((o) => o.status === "accepted");
    if (!accepted.length) return;
    setUpdating(-1);
    try {
      const res = includeIntoActive
        ? await post<{
            route_group_id: string;
            total_distance_km: number;
            orders: Order[];
          }>("/courier/route/reoptimize", await withGps({ include_accepted: true }))
        : await post<{
            route_group_id: string;
            total_distance_km: number;
            orders: Order[];
          }>(
            "/courier/route/start",
            await withGps({ order_ids: accepted.map((o) => o.id) })
          );
      const n = res.orders?.length ?? accepted.length;
      const km =
        typeof res.total_distance_km === "number"
          ? ` · ~${res.total_distance_km.toFixed(1)} km`
          : "";
      toast.success(
        n > 1
          ? `Marshrut tuzildi 🛵 — ${n} ta stop${km}`
          : `Yetkazish boshlandi 🛵${km}`
      );
      refresh();
    } catch {
      toast.error("Marshrutni boshlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(null);
    }
  };

  const reoptimizeRoute = async () => {
    setUpdating(-2);
    try {
      const res = await post<{
        total_distance_km: number;
        orders: Order[];
      }>("/courier/route/reoptimize", await withGps());
      const n = res.orders?.length ?? 0;
      const km =
        typeof res.total_distance_km === "number"
          ? ` · ~${res.total_distance_km.toFixed(1)} km`
          : "";
      toast.success(`Marshrut yangilandi 🔄 — ${n} ta stop${km}`);
      refresh();
    } catch {
      toast.error("Marshrutni yangilab bo'lmadi");
    } finally {
      setUpdating(null);
    }
  };

  const markDelivered = async (id: number) => {
    const target = orders.find((o) => o.id === id);
    if (target && !confirmOutOfOrder(target, orders)) return;
    setUpdating(id);
    try {
      await post(`/courier/orders/${id}/delivered`, await withGps());
      const remaining = orders.filter(
        (o) => o.status === "delivering" && o.id !== id
      ).length;
      toast.success(
        remaining > 0
          ? `Yetkazildi ✅ · qolgan ${remaining} ta qayta tartiblandi`
          : "Buyurtma yetkazildi ✅"
      );
      if (remaining > 0) await offerNextStop();
      refresh();
    } catch {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(null);
    }
  };

  const accepted = orders.filter((o) => o.status === "accepted");
  const delivering = orders
    .filter((o) => o.status === "delivering")
    .slice()
    .sort(
      (a, b) => (a.route_sequence ?? 999) - (b.route_sequence ?? 999)
    );

  const openFullRoute = () => {
    const pts = delivering.filter((o) => o.lat != null && o.lng != null);
    if (!pts.length) {
      toast.error("Koordinatali manzil yo'q");
      return;
    }
    const parts = pts.map((o) => `${o.lat},${o.lng}`).join("~");
    window.open(`https://yandex.com/maps/?rtext=~${parts}&rtt=auto`, "_blank");
  };

  const sorted = [...orders].sort((a, b) => {
    const rank = (s: OrderStatus) =>
      s === "delivering" ? 0 : s === "accepted" ? 1 : 2;
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    if (a.status === "delivering" && b.status === "delivering") {
      return (a.route_sequence ?? 999) - (b.route_sequence ?? 999);
    }
    return a.created_at.localeCompare(b.created_at);
  });

  return (
    <>
      <PageHeader
        title="Buyurtmalar"
        subtitle={`Faol: ${orders.length}`}
        loading={loading || refreshing}
        onRefresh={refresh}
      />

      {loading ? (
        <ListSkeleton count={3} />
      ) : (
        <div className="p-4 space-y-3">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {accepted.length > 0 && delivering.length > 0 ? (
            <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 p-4 text-white shadow-md">
              <div className="font-extrabold text-sm">
                {accepted.length} ta yangi · marshrutga qo'shish
              </div>
              <div className="text-xs text-blue-100 mt-0.5">
                Joriy joydan qayta optimal tartib
              </div>
              <button
                type="button"
                disabled={updating === -1}
                onClick={() => startRoute(true)}
                className="mt-3 w-full rounded-xl bg-white text-blue-700 font-extrabold text-sm py-2.5 disabled:opacity-60"
              >
                {updating === -1
                  ? "…"
                  : `➕  Reysga qo'shish (${accepted.length})`}
              </button>
            </div>
          ) : (
            accepted.length >= 2 && (
              <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 p-4 text-white shadow-md">
                <div className="font-extrabold text-sm">
                  {accepted.length} ta buyurtma yig'ilgan
                </div>
                <div className="text-xs text-blue-100 mt-0.5">
                  Bir reysda eng qisqa yo'l bilan yetkazish
                </div>
                <button
                  type="button"
                  disabled={updating === -1}
                  onClick={() => startRoute(false)}
                  className="mt-3 w-full rounded-xl bg-white text-blue-700 font-extrabold text-sm py-2.5 disabled:opacity-60"
                >
                  {updating === -1
                    ? "…"
                    : `🛵  Yo'lga chiqish (${accepted.length} ta)`}
                </button>
              </div>
            )
          )}

          {delivering.length > 0 && (() => {
            const remainKm = delivering.reduce(
              (s, o) => s + (o.route_leg_km ?? 0),
              0
            );
            const next = delivering[0];
            const kmLabel =
              remainKm > 0 ? ` · qolgan ~${remainKm.toFixed(1)} km` : "";
            return (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <div className="text-sm font-extrabold text-emerald-800">
                  Reys: {delivering.length} ta stop{kmLabel}
                </div>
                {next && (
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                    Keyingi: #{next.route_sequence ?? 1} · № {next.number}
                  </div>
                )}
              </div>
            );
          })()}

          {delivering.length >= 2 && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 overflow-hidden">
              <button
                type="button"
                onClick={openFullRoute}
                className="w-full text-blue-800 text-sm font-bold py-3 px-4 flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Navigation size={16} />
                  Faol marshrut: {delivering.length} ta stop · Xaritada ochish
                </span>
                <span>→</span>
              </button>
              <button
                type="button"
                disabled={updating === -2}
                onClick={reoptimizeRoute}
                className="w-full border-t border-blue-100 text-blue-700 text-xs font-bold py-2.5 disabled:opacity-60"
              >
                {updating === -2 ? "…" : "🔄  Joriy joydan qayta tartiblash"}
              </button>
            </div>
          )}

          {orders.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-10 text-center text-slate-400"
            >
              <Bike size={32} className="mx-auto mb-2 opacity-30" />
              <p>Hozircha buyurtma yo'q</p>
            </motion.div>
          )}

          <motion.div
            className="space-y-3"
            variants={listContainer}
            initial="initial"
            animate="animate"
          >
            <AnimatePresence initial={false}>
              {sorted.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  variants={listItem}
                  exit="exit"
                  className="card p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {o.status === "delivering" && o.route_sequence != null && (
                        <span
                          className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full text-white text-xs font-extrabold ${
                            o.route_sequence === 1 ? "bg-brand" : "bg-blue-600"
                          }`}
                        >
                          {o.route_sequence === 1 ? "#1 KEYINGI" : `#${o.route_sequence}`}
                        </span>
                      )}
                      <span className="font-bold text-lg">№ {o.number}</span>
                      <span className={`pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                    </div>
                    <span className="font-bold text-brand">{money(o.total)} so'm</span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600 mb-3">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                      <span>{o.address_line}</span>
                    </div>
                    {o.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400" />
                        <a href={`tel:${o.phone}`} className="text-brand font-medium">{o.phone}</a>
                      </div>
                    )}
                    {(orderDistanceLabel(o) || etaLabel(o.eta_minutes)) && (
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                        {orderDistanceLabel(o) && (
                          <span className="flex items-center gap-1">
                            <Navigation size={12} className="text-slate-400" />
                            {orderDistanceLabel(o)}
                          </span>
                        )}
                        {etaLabel(o.eta_minutes) && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {etaLabel(o.eta_minutes)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
                    {o.items.map((it) =>
                      it.image_url ? (
                        <img
                          key={it.id}
                          src={it.image_url}
                          alt={it.name_uz}
                          title={`${it.name_uz} · ${qtyUnit(it.quantity, it.unit)}${it.note ? ` · ${it.note}` : ""}`}
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                      ) : (
                        <div
                          key={it.id}
                          title={`${it.name_uz} · ${qtyUnit(it.quantity, it.unit)}${it.note ? ` · ${it.note}` : ""}`}
                          className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-sm shrink-0"
                        >
                          🍽
                        </div>
                      )
                    )}
                    <span className="text-xs text-slate-400 ml-1 shrink-0">
                      {o.items.length} ta mahsulot
                    </span>
                  </div>

                  {o.items.some((it) => it.note) && (
                    <div className="mb-3 -mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                      💬 Mahsulot izohlari bor — batafsilda ko'ring
                    </div>
                  )}

                  <div className="flex gap-2">
                    <motion.button
                      whileTap={tap}
                      className="btn-ghost flex-1 justify-center text-sm py-2"
                      onClick={() => nav(`/orders/${o.id}`)}
                    >
                      Batafsil
                    </motion.button>
                    {isAcceptableOrderStatus(o.status) && (
                      <motion.button
                        whileTap={tap}
                        className="btn flex-1 justify-center text-sm py-2 !bg-cyan-600"
                        disabled={updating === o.id}
                        onClick={() => setStatus(o.id, "accepted")}
                      >
                        {updating === o.id ? "…" : "Qabul qilish ✅"}
                      </motion.button>
                    )}
                    {o.status === "accepted" && (
                      <motion.button
                        whileTap={tap}
                        className="btn flex-1 justify-center text-sm py-2 !bg-blue-600"
                        disabled={updating === o.id}
                        onClick={() => setStatus(o.id, "delivering")}
                      >
                        {updating === o.id ? "…" : "Yetkazaman 🛵"}
                      </motion.button>
                    )}
                    {o.status === "delivering" && (
                      <motion.button
                        whileTap={tap}
                        className="btn flex-1 justify-center text-sm py-2 !bg-emerald-600"
                        disabled={updating === o.id}
                        onClick={() => markDelivered(o.id)}
                      >
                        {updating === o.id ? "…" : "Yetkazdim ✓"}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </>
  );
}
