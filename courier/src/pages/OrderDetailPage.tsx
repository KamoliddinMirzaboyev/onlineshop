import { ArrowLeft, Clock, CreditCard, MapPin, Navigation, Phone, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, patch, post } from "../api";
import { OrderDetailSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import {
  canNavigate,
  distanceLabel,
  etaLabel,
  money,
  paymentLabel,
  qtyUnit,
  statusLabel,
  statusPill,
} from "../lib/format";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import { confirmOutOfOrder, offerNextStop } from "../lib/routeFlow";
import { getCurrentCoords } from "../location";
import type { Order, OrderStatus } from "../types";
import NavChooser from "../components/NavChooser";


export default function OrderDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [updating, setUpdating] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // 404 → the order is truly gone, leave the screen. Other errors are kept as
  // transient (cache shows last good copy or an inline retry).
  const fetcher = useCallback(
    () =>
      get<Order>(`/courier/orders/${id}`).catch((err) => {
        if (String(err).includes("404")) nav("/orders");
        throw err;
      }),
    [id, nav]
  );

  const { data: order, loading, error, refresh } = useResource<Order>(
    id ? `courier_order_${id}` : null,
    fetcher,
    { errorText: "Buyurtmani yuklab bo'lmadi. Internetni tekshiring." }
  );

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

  const setStatus = async (status: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      if (status === "delivering") {
        const res = await post<{
          total_distance_km?: number;
          orders?: Order[];
        }>("/courier/route/start", await withGps({ order_ids: null }));
        const n = res.orders?.length ?? 1;
        const km =
          typeof res.total_distance_km === "number"
            ? ` · ~${res.total_distance_km.toFixed(1)} km`
            : "";
        toast.success(
          n > 1
            ? `Marshrut tuzildi 🛵 — ${n} ta stop${km}`
            : `Yetkazish boshlandi 🛵 — mijozga chek + ETA${km}`
        );
      } else {
        await patch(`/courier/orders/${order.id}`, { status });
        toast.success("Buyurtma qabul qilindi ✅");
      }
      refresh();
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(false);
    }
  };

  const markDelivered = async () => {
    if (!order) return;
    try {
      const list = await get<Order[]>("/courier/orders");
      if (!confirmOutOfOrder(order, list)) return;
    } catch {
      /* pool olish muvaffaqiyatsiz — ogohlantirishsiz davom */
    }
    setUpdating(true);
    try {
      await post<Order>(
        `/courier/orders/${order.id}/delivered`,
        await withGps()
      );
      toast.success("Buyurtma yetkazildi ✅ · qolgan marshrut yangilandi");
      await offerNextStop();
      refresh();
    } catch {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUpdating(false);
    }
  };

  const openRemainingRoute = async () => {
    if (!order) return;
    try {
      const list = await get<Order[]>("/courier/orders");
      const fromSeq = order.route_sequence ?? 1;
      const pts = list
        .filter((o) => o.status === "delivering")
        .filter((o) => o.lat != null && o.lng != null)
        .filter((o) => (o.route_sequence ?? 999) >= fromSeq)
        .sort(
          (a, b) => (a.route_sequence ?? 999) - (b.route_sequence ?? 999)
        );
      if (!pts.length) {
        toast.error("Koordinatali manzil yo'q");
        return;
      }
      const parts = pts.map((o) => `${o.lat},${o.lng}`).join("~");
      window.open(`https://yandex.com/maps/?rtext=~${parts}&rtt=auto`, "_blank");
    } catch {
      toast.error("Marshrutni yuklab bo'lmadi");
    }
  };




  if (loading && !order) return <OrderDetailSkeleton />;

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400 p-4 text-center">
        <p>{error ?? "Buyurtmani yuklab bo'lmadi. Internetni tekshiring."}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium active:scale-95 transition"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  const hasNav = canNavigate(order.lat, order.lng, order.address_line);

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto">
      <motion.button
        whileTap={tap}
        onClick={() => nav(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 mb-4"
      >
        <ArrowLeft size={16} /> Orqaga
      </motion.button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold">Buyurtma № {order.number}</h1>
        <span className={`pill ${statusPill(order.status)}`}>{statusLabel(order.status)}</span>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        {new Date(order.created_at).toLocaleString("ru-RU")}
      </p>

      <motion.div
        variants={listContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={listItem} className="card p-4 mb-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin size={16} className="text-brand shrink-0 mt-0.5" />
            <span className="font-medium">{order.address_line}</span>
          </div>
          {order.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={16} className="text-brand" />
              <a href={`tel:${order.phone}`} className="text-brand font-semibold underline">
                {order.phone}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <CreditCard size={16} className="text-slate-400" />
            <span>
              {paymentLabel(order.payment_method)}
              {order.payment_status === "paid" && (
                <span className="ml-1 text-emerald-600 font-medium">· To'langan</span>
              )}
              {order.payment_method === "cash" && order.payment_status !== "paid" && (
                <span className="ml-1 text-amber-600 font-medium">· Naqd olinadi</span>
              )}
            </span>
          </div>
          {order.comment && (
            <div className="text-sm text-slate-500 bg-amber-50 rounded-lg px-3 py-2">
              💬 {order.comment}
            </div>
          )}
          {(distanceLabel(order.distance_km) || etaLabel(order.eta_minutes)) && (
            <div className="flex items-center gap-4 text-sm pt-1">
              {distanceLabel(order.distance_km) && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Navigation size={15} className="text-slate-400" />
                  {distanceLabel(order.distance_km)}
                </span>
              )}
              {etaLabel(order.eta_minutes) && (
                <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                  <Clock size={15} /> {etaLabel(order.eta_minutes)}
                </span>
              )}
            </div>
          )}
          {hasNav && (
            <>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setNavOpen(true)}
                className="btn w-full justify-center text-sm py-2.5 mt-1"
              >
                <Navigation size={16} />{" "}
                {order.route_sequence === 1
                  ? "Navigatsiya · KEYINGI stop"
                  : "Navigatsiya"}
              </motion.button>
              {order.status === "delivering" && (
                <button
                  type="button"
                  onClick={openRemainingRoute}
                  className="w-full text-sm font-bold text-blue-700 py-2"
                >
                  Qolgan marshrut (multi-stop)
                </button>
              )}
            </>
          )}
        </motion.div>

        <motion.div variants={listItem} className="card p-4 mb-3">
          <h2 className="font-semibold mb-3 text-sm text-slate-500 uppercase tracking-wide">
            Mahsulotlar
          </h2>
          <div className="space-y-2.5">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 text-sm">
                {it.image_url ? (
                  <img src={it.image_url} alt="" className="h-12 w-12 rounded-xl object-cover bg-slate-100 shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">🍽</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.name_uz}</div>
                  <div className="text-xs text-slate-400">
                    {qtyUnit(it.quantity, it.unit)} × {money(it.price)} so'm
                  </div>
                  {it.note && (
                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-block">
                      💬 {it.note}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 self-start">
                  <span className="font-semibold">{money(it.price * it.quantity)} so'm</span>
                </div>
              </div>
            ))}
            <hr className="border-slate-100" />
            <div className="flex justify-between text-sm text-slate-500">
              <span>Yetkazish</span>
              <span>{money(order.delivery_fee)} so'm</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Jami</span>
              <span className="text-brand">{money(order.total)} so'm</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="space-y-2">
        {isAcceptableOrderStatus(order.status) && (
          <motion.button
            whileTap={tap}
            className="w-full py-3.5 rounded-2xl bg-cyan-600 text-white font-bold text-base shadow-lg shadow-cyan-200 transition disabled:opacity-50"
            disabled={updating}
            onClick={() => setStatus("accepted")}
          >
            {updating ? "…" : "✅  Qabul qilish"}
          </motion.button>
        )}
        {order.status === "accepted" && (
          <motion.button
            whileTap={tap}
            className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-base shadow-lg shadow-blue-200 transition disabled:opacity-50"
            disabled={updating}
            onClick={() => setStatus("delivering")}
          >
            {updating ? "…" : "🛵  Yetkazishni boshlash"}
          </motion.button>
        )}
        {order.status === "delivering" && (
          <motion.button
            whileTap={tap}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-base shadow-lg shadow-emerald-200 transition disabled:opacity-50"
            disabled={updating}
            onClick={markDelivered}
          >
            {updating ? "…" : "✓  Yetkazdim"}
          </motion.button>
        )}
        <motion.button
          whileTap={tap}
          className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium transition"
          onClick={() => nav(-1)}
        >
          Orqaga
        </motion.button>
      </div>

      <NavChooser
        open={navOpen}
        onClose={() => setNavOpen(false)}
        lat={order.lat}
        lng={order.lng}
        address={order.address_line}
      />
    </div>
  );
}
