import { Bell, Bike, CheckCircle2, Clock, MapPin, Wallet, XCircle, Navigation } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, patch } from "../api";
import PageHeader from "../components/PageHeader";
import { DashboardSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import { formatDateTime, formatDay, money, statusLabel, statusPill, multiRouteUrl } from "../lib/format";
import { useAuth, useOrderAlerts } from "../store";
import type { CourierStats, Order } from "../types";

const POLL_INTERVAL_MS = 60000;

export default function DashboardPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { username } = useAuth();
  const availableCount = useOrderAlerts((s) => s.availableCount);
  const setAvailableCount = useOrderAlerts((s) => s.setAvailableCount);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const { data: stats, loading, refreshing, error, refresh } = useResource<CourierStats>(
    "courier_stats",
    () => get<CourierStats>("/courier/stats"),
    { pollMs: POLL_INTERVAL_MS, errorText: "Statistikani yuklab bo'lmadi. Internetni tekshiring." }
  );
  const {
    data: activeOrders,
    refreshing: ordersRefreshing,
    refresh: refreshOrders,
  } = useResource<Order[]>(
    "courier_orders",
    () => get<Order[]>("/courier/orders"),
    { pollMs: 60000, errorText: "Buyurtmalarni yuklab bo'lmadi. Internetni tekshiring." }
  );
  const { data: recent } = useResource<Order[]>(
    "courier_recent",
    () => get<Order[]>("/courier/history?limit=3"),
    { pollMs: POLL_INTERVAL_MS }
  );

  const myActiveOrders = (activeOrders ?? [])
    .filter((o) => o.assigned_courier_id != null)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const availableOrders = (activeOrders ?? [])
    .filter((o) => o.assigned_courier_id == null && isAcceptableOrderStatus(o.status))
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const previewOrders = availableOrders.slice(0, 3);

  useEffect(() => {
    setAvailableCount(availableOrders.length);
  }, [availableOrders.length, setAvailableCount]);

  useEffect(() => {
    const onPush = () => refreshOrders();
    window.addEventListener("courier-push", onPush);
    return () => window.removeEventListener("courier-push", onPush);
  }, [refreshOrders]);

  const acceptOrder = async (order: Order) => {
    setAcceptingId(order.id);
    try {
      await patch(`/courier/orders/${order.id}`, { status: "accepted" });
      toast.success(`№ ${order.number} qabul qilindi ✅`);
      refreshOrders();
      refresh();
    } catch {
      toast.error("Buyurtmani qabul qilib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={`Salom, ${username ?? "kuryer"} 👋`}
        subtitle="Barakali Bozor Kuryer"
        loading={loading || refreshing || ordersRefreshing}
        onRefresh={() => {
          refresh();
          refreshOrders();
        }}
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <motion.div
          className="p-4 space-y-4"
          variants={listContainer}
          initial="initial"
          animate="animate"
        >
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Yangi (hali hech kimga biriktirilmagan) buyurtmalar */}
          {availableCount > 0 && (
            <motion.div variants={listItem} className="space-y-2.5">
              <button
                onClick={() => nav("/orders")}
                className="w-full card p-4 flex items-center justify-between text-left bg-brand text-white border-none shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                    <Bell size={22} />
                  </div>
                  <div>
                    <div className="text-sm text-white/80">Yangi buyurtma bor</div>
                    <div className="text-2xl font-bold">{availableCount} ta</div>
                  </div>
                </div>
                <span className="text-sm font-semibold">Barchasi →</span>
              </button>

              {previewOrders.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  className="card p-4 border-2 border-brand/25 bg-white"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                         <span className="font-bold">№ {o.number}</span>
                         <span className={`pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                      </div>
                      <div className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                        <MapPin size={14} className="shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{o.address_line}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} />
                        {formatDateTime(o.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <button
                      onClick={() => acceptOrder(o)}
                      disabled={acceptingId === o.id}
                      className="btn justify-center py-2.5 text-sm !bg-cyan-600 disabled:opacity-50"
                    >
                      {acceptingId === o.id ? "…" : "Qabul qilish ✅"}
                    </button>
                    <button
                      onClick={() => nav(`/orders/${o.id}`)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600"
                    >
                      Ko'rish
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Faol buyurtmalarim */}
          {myActiveOrders.length > 0 && (
            <motion.div variants={listItem}>
              <div className="flex items-center justify-between gap-2 mb-3 mt-1">
                <div className="flex items-center gap-2">
                  <Bike size={18} className="text-brand" />
                  <h2 className="font-bold text-lg">Mening faol buyurtmalarim</h2>
                </div>
                {myActiveOrders.length > 1 && multiRouteUrl(
                  myActiveOrders
                    .filter((o) => o.lat != null && o.lng != null)
                    .map((o) => ({ lat: o.lat!, lng: o.lng! }))
                ) && (
                  <a
                    href={multiRouteUrl(
                      myActiveOrders
                        .filter((o) => o.lat != null && o.lng != null)
                        .map((o) => ({ lat: o.lat!, lng: o.lng! }))
                    ) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm font-medium"
                  >
                    <Navigation size={14} /> Xarita
                  </a>
                )}
              </div>
              <div className="space-y-3">
                {myActiveOrders.map((o) => (
                  <motion.div
                    key={o.id}
                    layout
                    className="card p-4 border-2 border-slate-200 bg-white"
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">№ {o.number}</span>
                        <span className={`pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 text-sm text-slate-600 mb-3">
                      <MapPin size={15} className="shrink-0 mt-0.5 text-slate-400" />
                      <span className="line-clamp-2">{o.address_line}</span>
                    </div>
                    <button
                      onClick={() => nav(`/orders/${o.id}`)}
                      className="w-full btn justify-center py-2.5 text-sm"
                    >
                      Batafsil va boshqarish →
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bugun (Faqat yetkazilganlar va bekor qilinganlar) */}
          <motion.div variants={listItem}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-2">
              Bugungi statistika
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<CheckCircle2 size={18} className="text-emerald-600" />}
                value={stats?.today.delivered ?? 0}
                label="Yetkazildi"
              />
              <StatCard
                icon={<XCircle size={18} className="text-rose-500" />}
                value={stats?.today.cancelled ?? 0}
                label="Bekor qilindi"
              />
            </div>
          </motion.div>

          {/* So'nggi buyurtmalar (History) */}
          {recent && recent.length > 0 && (
            <motion.div variants={listItem} className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Tarix (So'nggi 3 ta)
                </p>
                <button onClick={() => nav("/history")} className="text-xs font-semibold text-brand">
                  Barchasi →
                </button>
              </div>
              <div className="space-y-2.5">
                {recent.map((o) => (
                  <motion.button
                    key={o.id}
                    whileTap={tap}
                    onClick={() => nav(`/orders/${o.id}`)}
                    className="w-full card p-3.5 text-left"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">№ {o.number}</span>
                        <span className={`pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-1">
                      <MapPin size={12} className="shrink-0 mt-0.5 text-slate-400" />
                      <span className="line-clamp-1">{o.address_line}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock size={11} />
                      {formatDateTime(o.created_at)}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      {icon}
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
