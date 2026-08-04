import { Bell, CheckCircle2, MapPin, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, patch, post } from "../api";
import PageHeader from "../components/PageHeader";
import { DashboardSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useResource } from "../lib/cache";
import { listContainer, listItem, tap } from "../lib/motion";
import { isAcceptableOrderStatus } from "../lib/orderActions";
import { money, statusLabel, statusPill } from "../lib/format";
import { useAuth, useOrderAlerts } from "../store";
import type { CourierStats, Order } from "../types";

const POLL_MS = 20000;

export default function DashboardPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { username, name } = useAuth();
  const availableCount = useOrderAlerts((s) => s.availableCount);
  const setAvailableCount = useOrderAlerts((s) => s.setAvailableCount);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: stats, loading, refreshing, error, refresh } = useResource<CourierStats>(
    "courier_stats",
    () => get<CourierStats>("/courier/stats"),
    { pollMs: 30000, errorText: "Statistikani yuklab bo'lmadi." },
  );

  const {
    data: activeOrders,
    refreshing: ordersRefreshing,
    refresh: refreshOrders,
  } = useResource<Order[]>(
    "courier_orders",
    () => get<Order[]>("/courier/orders"),
    { pollMs: POLL_MS, errorText: "Buyurtmalarni yuklab bo'lmadi." },
  );

  const greet = (name?.trim().split(/\s+/)[0] || username || "kuryer");

  const myActive = (activeOrders ?? [])
    .filter((o) => o.status === "accepted" || o.status === "delivering")
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const available = (activeOrders ?? [])
    .filter((o) => o.assigned_courier_id == null && isAcceptableOrderStatus(o.status))
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  useEffect(() => {
    setAvailableCount(available.length);
  }, [available.length, setAvailableCount]);

  useEffect(() => {
    const onPush = () => {
      refreshOrders();
      refresh();
    };
    window.addEventListener("courier-push", onPush);
    return () => window.removeEventListener("courier-push", onPush);
  }, [refreshOrders, refresh]);

  const accept = async (order: Order) => {
    setBusyId(order.id);
    try {
      await patch(`/courier/orders/${order.id}`, { status: "accepted" });
      toast.success(`№ ${order.number} qabul qilindi ✅`);
      refreshOrders();
      refresh();
    } catch {
      toast.error("Qabul qilib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const startDeliver = async (order: Order) => {
    setBusyId(order.id);
    try {
      await patch(`/courier/orders/${order.id}`, { status: "delivering" });
      toast.success("Yetkazish boshlandi 🛵");
      refreshOrders();
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const markDone = async (order: Order) => {
    setBusyId(order.id);
    try {
      await post(`/courier/orders/${order.id}/delivered`, {});
      toast.success("Yetkazildi ✅");
      refreshOrders();
      refresh();
    } catch {
      toast.error("Yakunlab bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={`Salom, ${greet} 👋`}
        subtitle="BB Kuryer"
        loading={loading || refreshing || ordersRefreshing}
        onRefresh={() => {
          refresh();
          refreshOrders();
        }}
      />

      {loading && !stats ? (
        <DashboardSkeleton />
      ) : (
        <motion.div
          className="p-4 space-y-3.5 pb-6"
          variants={listContainer}
          initial="initial"
          animate="animate"
        >
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>
          )}

          {/* KPI — faqat 2 ta */}
          <motion.div variants={listItem} className="grid grid-cols-2 gap-2.5">
            <div className="card p-3.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center mb-2.5">
                <CheckCircle2 size={18} />
              </div>
              <div className="text-xl font-extrabold leading-none">
                {stats?.today.delivered ?? 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">Bugun yetkazildi</div>
            </div>
            <div className="card p-3.5">
              <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand grid place-items-center mb-2.5">
                <Wallet size={18} />
              </div>
              <div className="text-xl font-extrabold leading-none truncate">
                {money(stats?.today.earnings ?? 0)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Bugungi daromad</div>
            </div>
          </motion.div>

          {/* Yangi buyurtmalar */}
          {availableCount > 0 && (
            <motion.div variants={listItem} className="space-y-2.5">
              <button
                type="button"
                onClick={() => nav("/orders")}
                className="w-full card p-4 flex items-center justify-between text-left bg-brand text-white border-none shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-white/20 grid place-items-center">
                    <Bell size={22} />
                  </div>
                  <div>
                    <div className="text-sm text-white/80">Yangi buyurtma</div>
                    <div className="text-2xl font-bold">{availableCount} ta</div>
                  </div>
                </div>
                <span className="text-sm font-semibold">Barchasi →</span>
              </button>

              {available.slice(0, 2).map((o) => (
                <div key={o.id} className="card p-4 border-2 border-brand/20">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold">№ {o.number}</div>
                    <div className="font-bold text-brand text-sm shrink-0">
                      {money(o.total)} so'm
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
                    <MapPin size={14} className="shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{o.address_line}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <button
                      type="button"
                      onClick={() => accept(o)}
                      disabled={busyId === o.id}
                      className="btn justify-center py-2.5 text-sm !bg-cyan-600 disabled:opacity-50"
                    >
                      {busyId === o.id ? "…" : "Qabul qilish"}
                    </button>
                    <button
                      type="button"
                      onClick={() => nav(`/orders/${o.id}`)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600"
                    >
                      Ko'rish
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Joriy ish */}
          {myActive.length > 0 && (
            <motion.div variants={listItem} className="space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Joriy ish
              </p>
              {myActive.map((o) => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">№ {o.number}</span>
                    <span className={`pill ${statusPill(o.status)}`}>{statusLabel(o.status)}</span>
                    <span className="ml-auto font-bold text-brand text-sm">
                      {money(o.total)} so'm
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
                    <MapPin size={14} className="shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{o.address_line}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {o.status === "accepted" ? (
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => startDeliver(o)}
                        className="btn flex-1 justify-center py-2.5 text-sm disabled:opacity-50"
                      >
                        {busyId === o.id ? "…" : "Yo'lga chiqish 🛵"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => markDone(o)}
                        className="btn flex-1 justify-center py-2.5 text-sm !bg-emerald-600 disabled:opacity-50"
                      >
                        {busyId === o.id ? "…" : "Yetkazildi ✅"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => nav(`/orders/${o.id}`)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Bo'sh holat */}
          {availableCount === 0 && myActive.length === 0 && (
            <motion.div variants={listItem} className="card p-8 text-center">
              <div className="text-4xl mb-2 opacity-40">🛵</div>
              <div className="font-semibold text-slate-600">Hozircha ish yo'q</div>
              <p className="text-sm text-slate-400 mt-1">
                Yangi buyurtma kelganda shu yerda chiqadi
              </p>
              <button
                type="button"
                onClick={() => nav("/orders")}
                className="btn-ghost mt-4 mx-auto text-sm"
              >
                Buyurtmalarga o'tish
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
}
