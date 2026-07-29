import { ChevronDown, MapPin, Phone, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { get, getAll, patch, withStore } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import { useStore } from "../store";
import type { Order, OrderStatus } from "../types";

const STATUSES: OrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "accepted", "delivering", "delivered", "cancelled",
];
const LABEL: Record<OrderStatus, string> = {
  pending: "Yangi", confirmed: "Tasdiqlandi", preparing: "Tayyorlanmoqda",
  ready: "Tayyor", accepted: "Kuryer qabul qildi", delivering: "Yetkazilmoqda",
  delivered: "Yetkazildi", cancelled: "Bekor",
};
const PILL: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-sky-100 text-sky-700",
  preparing: "bg-indigo-100 text-indigo-700",
  ready: "bg-violet-100 text-violet-700",
  accepted: "bg-cyan-100 text-cyan-700",
  delivering: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

export default function OrdersPage() {
  const selectedStoreId = useStore((s) => s.selectedStoreId);
  const stores = useStore((s) => s.stores);
  const isAll = selectedStoreId === "all";
  const storeName = (rid: number) => stores.find((s) => s.id === rid)?.name ?? "—";
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  // Poll tick and manual refresh must not clobber each other's newer state.
  const inFlight = useRef(false);

  const load = async () => {
    if (selectedStoreId == null || inFlight.current) return;
    inFlight.current = true;
    const q = filter ? `?status_filter=${filter}` : "";
    try {
      const d = isAll
        ? await getAll<Order>(`/admin/orders${q}`, stores.map((s) => s.id))
        : await get<Order[]>(withStore(`/admin/orders${q}`, selectedStoreId));
      d.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setOrders(d);
      setErr(false);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (selectedStoreId == null) return;
    setLoading(true);
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedStoreId, stores.length]);

  const cancel = async (o: Order) => {
    const ok = await confirm({
      title: `№ ${o.number} buyurtmani bekor qilasizmi?`,
      message: "Buyurtma bekor qilinadi. Bu amalni qaytarib bo'lmaydi.",
      confirmText: "Bekor qilish",
      cancelText: "Yo'q",
      danger: true,
    });
    if (!ok) return;

    const prev = orders;
    setBusy(o.id);
    setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: "cancelled" } : x)));
    try {
      await patch(withStore(`/admin/orders/${o.id}`, o.restaurant_id), { status: "cancelled" });
      toast.success(`№ ${o.number}: bekor qilindi`);
    } catch {
      setOrders(prev);
      toast.error("Bekor qilib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  if (selectedStoreId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Buyurtmalar</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">Avval "Do'konlar" bo'limida do'kon yarating, so'ng yuqoridagi ro'yxatdan tanlang</div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-14 z-20 -mt-4 md:-mt-8 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 md:pt-8 pb-3 bg-[#f8fafc] md:bg-[#f8fafc]/95 md:backdrop-blur-md border-b border-slate-200 shadow-sm mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Buyurtmalar</h1>
        <p className="text-slate-500 mb-4">Kuzatuv rejimi — kuryer buyurtmani o'zi qabul qiladi</p>

        <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${
              filter === ""
                ? "bg-brand text-white shadow-md shadow-brand/25"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
            }`}
            onClick={() => setFilter("")}
          >
            Hammasi
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${
                filter === s
                  ? "bg-brand text-white shadow-md shadow-brand/25"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
              }`}
              onClick={() => setFilter(s)}
            >
              {LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <TableSkeleton cols={4} /> : err && orders.length === 0 ? <ErrorRetry onRetry={load} /> : (
      <div className="space-y-4">
        {orders.map((o) => {
          const isNew = o.status === "pending";
          const isOpen = open === o.id;
          const itemsCount = o.items.reduce((s, it) => s + it.quantity, 0);
          const canCancel = o.status !== "delivered" && o.status !== "cancelled";
          return (
          <div key={o.id} className={`card p-4 ${isNew ? "ring-2 ring-amber-300 bg-amber-50/40" : ""}`}>
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">№ {o.number}</span>
                  <span className={`pill ${PILL[o.status]}`}>{LABEL[o.status]}</span>
                  {isAll && <span className="pill bg-slate-100 text-slate-600">{storeName(o.restaurant_id)}</span>}
                </div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                  <MapPin size={14} className="shrink-0" /> {o.address_line}
                </div>
                {o.phone && (
                  <a href={`tel:${o.phone}`} className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-brand">
                    <Phone size={14} className="shrink-0" /> {o.phone}
                  </a>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold">{money(o.total)} so'm</div>
                <div className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString()}</div>
              </div>
            </div>

            <button
              onClick={() => setOpen(isOpen ? null : o.id)}
              className="mt-3 text-sm text-slate-500 inline-flex items-center gap-1 hover:text-brand"
            >
              <ChevronDown size={15} className={`transition ${isOpen ? "rotate-180" : ""}`} />
              {itemsCount} dona mahsulot
            </button>

            {isOpen && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {o.items.map((it) => (
                  <div key={it.id} className="shrink-0 w-16 text-center">
                    {it.image_url ? (
                      <img src={it.image_url} alt="" className="h-16 w-16 rounded-xl object-cover bg-slate-100" />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center text-xl">🍽</div>
                    )}
                    <div className="text-[11px] text-slate-600 mt-1 leading-tight line-clamp-2">{it.name_uz}</div>
                    <div className="text-[11px] font-semibold text-slate-400">×{it.quantity}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Kuryer holati */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {o.assigned_courier_id ? (
                <span className="pill bg-slate-100 text-slate-600 inline-flex items-center gap-1">
                  <User size={12} /> {o.assigned_courier_name ?? `#${o.assigned_courier_id}`}
                </span>
              ) : (
                canCancel && (
                  <span className="pill bg-amber-50 text-amber-600">Kuryer kutilmoqda</span>
                )
              )}
              {o.assigned_courier_phone && (
                <a
                  href={`tel:${o.assigned_courier_phone}`}
                  className="pill bg-slate-100 text-slate-600 inline-flex items-center gap-1 hover:text-brand"
                >
                  <Phone size={12} /> {o.assigned_courier_phone}
                </a>
              )}
            </div>

            {canCancel && (
              <div className="mt-3">
                <button
                  disabled={busy === o.id}
                  onClick={() => cancel(o)}
                  className="px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <X size={15} /> Bekor qilish
                </button>
              </div>
            )}
          </div>
          );
        })}
        {orders.length === 0 && (
          <div className="card p-10 text-center text-slate-400">Buyurtmalar yo'q</div>
        )}
      </div>
      )}
    </div>
  );
}
