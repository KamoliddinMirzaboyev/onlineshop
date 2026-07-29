import { Bike, MapPin, Navigation, Phone, Printer, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { get, patch } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, OrderListSkeleton } from "../components/Skeleton";
import type { Order, OrderStatus } from "../types";

const FILTER_TABS = [
  { value: "pending", label: "Yangi" },
  { value: "", label: "Barchasi" },
  { value: "accepted", label: "Kuryer qabul qildi" },
  { value: "delivering", label: "Yetkazilmoqda" },
  { value: "delivered", label: "Yetkazildi" },
  { value: "cancelled", label: "Bekor" },
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

// Yangi/faol buyurtmalar tepada; yakunlanganlar pastda.
const RANK: Record<OrderStatus, number> = {
  pending: 0, confirmed: 1, preparing: 2, ready: 3, accepted: 4,
  delivering: 5, delivered: 6, cancelled: 7,
};

const printReceipt = (o: Order) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const dateStr = new Date(o.created_at).toLocaleString("ru-RU");

  let itemsHtml = "";
  o.items.forEach((it, idx) => {
    itemsHtml += `
      <tr>
        <td class="text-left" colspan="2" style="padding-bottom: 2px;">${idx + 1}. ${it.name_uz}</td>
      </tr>
      <tr>
        <td class="text-left" style="padding-bottom: 6px; color: #444;">${it.quantity} x ${money(it.price)}</td>
        <td class="text-right" style="padding-bottom: 6px;">${money(it.price * it.quantity)}</td>
      </tr>
    `;
  });

  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Chek №${o.number}</title>
        <style>
          @page { margin: 0; size: auto; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            margin: 0; 
            padding: 4mm; 
            color: #000; 
            font-size: 13px;
            line-height: 1.4;
            max-width: 80mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; }
          .header { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="header">BARAKALI BOZOR</div>
        <div class="divider"></div>
        <div><b>Buyurtma №:</b> ${o.number}</div>
        <div><b>Sana:</b> ${dateStr}</div>
        ${o.customer_name ? `<div><b>Mijoz:</b> ${o.customer_name}</div>` : ""}
        <div><b>Mijoz tel:</b> ${o.phone || "-"}</div>
        <div><b>Manzil:</b> ${o.address_line}</div>
        ${o.comment ? `<div><b>Izoh:</b> ${o.comment}</div>` : ""}
        <div class="divider"></div>
        <table>
          ${itemsHtml}
        </table>
        <div class="divider"></div>
        <table>
          <tr>
            <td class="text-left">Mahsulotlar:</td>
            <td class="text-right">${money(o.items_total)}</td>
          </tr>
          <tr>
            <td class="text-left">Yetkazib berish:</td>
            <td class="text-right">${money(o.delivery_fee)}</td>
          </tr>
          <tr>
            <td class="text-left font-bold" style="font-size: 15px; padding-top: 5px;">UMUMIY:</td>
            <td class="text-right font-bold" style="font-size: 15px; padding-top: 5px;">${money(o.total)}</td>
          </tr>
        </table>
        <div class="divider"></div>
        ${o.assigned_courier_name ? `<div><b>Kuryer:</b> ${o.assigned_courier_name}</div>` : ""}
        ${o.assigned_courier_phone ? `<div><b>Tel:</b> ${o.assigned_courier_phone}</div>` : ""}
        <div class="text-center font-bold" style="margin-top: 10px;">Xaridingiz uchun rahmat!</div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  // Guard so a poll tick and a manual refresh never run concurrently and
  // clobber each other's (potentially newer) state.
  const inFlight = useRef(false);

  const load = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const q = filter ? `?status_filter=${filter}` : "";
    try {
      const d = await get<Order[]>(`/admin/orders${q}`);
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
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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
      await patch(`/admin/orders/${o.id}`, { status: "cancelled" });
      toast.success(`№ ${o.number}: bekor qilindi`);
      load();
    } catch {
      setOrders(prev);
      setErr(true);
      toast.error("Bekor qilib bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...orders].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      +new Date(b.created_at) - +new Date(a.created_at)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Buyurtmalar</h1>
        <p className="text-slate-500 mb-4">Kuzatuv rejimi — kuryer buyurtmani o'zi qabul qiladi</p>

        <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${
              filter === tab.value
                ? "bg-brand text-white shadow-md shadow-brand/25"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
            }`}
            onClick={() => setFilter(tab.value as any)}
          >
            {tab.label}
          </button>
          ))}
        </div>
      </div>

      {loading ? <OrderListSkeleton /> : err && orders.length === 0 ? <ErrorRetry onRetry={load} /> : (
      <div className="space-y-4">
        {sorted.map((o) => {
          const isNew = o.status === "pending";
          const itemsCount = o.items.reduce((s, it) => s + it.quantity, 0);
          return (
          <div
            key={o.id}
            className={`bg-white rounded-3xl shadow-sm border p-5 md:p-6 transition-all ${
              isNew ? "border-amber-300 ring-4 ring-amber-500/10 bg-amber-50/20" : "border-slate-200 hover:border-slate-300 hover:shadow-md"
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">№ {o.number}</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold tracking-wide ${PILL[o.status]}`}>{LABEL[o.status]}</span>
                </div>
                
                <div className="space-y-2 mt-4">
                  <div className="text-base text-slate-600 flex items-start gap-2.5">
                    <MapPin size={20} className="shrink-0 text-slate-400 mt-0.5" /> 
                    <span className="leading-snug">{o.address_line}</span>
                  </div>
                  {o.phone && (
                    <a href={`tel:${o.phone}`} className="text-base font-semibold text-slate-700 flex items-center gap-2.5 hover:text-brand w-fit transition-colors">
                      <Phone size={18} className="shrink-0 text-slate-400" /> {o.phone}
                    </a>
                  )}
                </div>
              </div>

              <div className="text-left md:text-right shrink-0 w-full md:w-auto bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-2xl">
                <div className="text-sm font-medium text-slate-500 mb-1">{new Date(o.created_at).toLocaleString()}</div>
                <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  {money(o.total)} <span className="text-lg text-slate-500 font-bold">so'm</span>
                </div>
              </div>
            </div>

            {/* Mahsulotlar — rasm bilan */}
            <div className="mt-8">
              <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                Mahsulotlar 
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs">{itemsCount} dona</span>
              </div>
              <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {o.items.map((it) => (
                  <div key={it.id} className="shrink-0 w-24 md:w-28 flex flex-col group">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 aspect-square shadow-sm group-hover:shadow-md transition">
                      {it.image_url ? (
                        <img src={it.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🍽</div>
                      )}
                      <div className="absolute top-0 right-0 bg-white/95 backdrop-blur-sm px-2 py-1 m-1.5 rounded-lg text-xs font-bold text-slate-800 shadow-sm border border-slate-200/50">
                        ×{it.quantity}
                      </div>
                    </div>
                    <div className="text-sm text-slate-700 mt-2.5 font-semibold leading-tight line-clamp-2" title={it.name_uz}>{it.name_uz}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Kuryer holati — faqat kuzatish, kuryer o'zi qabul qiladi */}
              <div className="flex flex-wrap items-center gap-3">
                {o.assigned_courier_id ? (
                  <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center gap-2">
                    <User size={18} className="text-slate-500" /> {o.assigned_courier_name ?? `#${o.assigned_courier_id}`}
                  </span>
                ) : null}
                {o.assigned_courier_phone && (
                  <a
                    href={`tel:${o.assigned_courier_phone}`}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-200 hover:text-brand transition"
                  >
                    <Phone size={18} className="text-slate-500" /> {o.assigned_courier_phone}
                  </a>
                )}
                {!o.assigned_courier_id && (
                  o.status !== "delivered" && o.status !== "cancelled" && (
                    <span className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-sm font-bold flex items-center gap-2">
                      <Bike size={18} /> Kuryer kutilmoqda
                    </span>
                  )
                )}
                {o.lat != null && o.lng != null && (
                  <a
                    href={`https://yandex.com/maps/?rtext=~${o.lat},${o.lng}&rtt=auto`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold inline-flex items-center gap-2 hover:bg-blue-100 hover:shadow-sm transition"
                  >
                    <Navigation size={18} /> Xarita
                  </a>
                )}
              </div>

              <div className="flex flex-col sm:flex-row shrink-0 gap-3 w-full md:w-auto">
                <button
                  onClick={() => printReceipt(o)}
                  className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 transition inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Printer size={18} /> Chop etish
                </button>
                {o.status !== "delivered" && o.status !== "cancelled" && (
                  <button
                    disabled={busy === o.id}
                    onClick={() => cancel(o)}
                    className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-600 hover:text-white hover:border-rose-600 transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-rose-50 disabled:hover:text-rose-600 disabled:hover:border-rose-200 shadow-sm"
                  >
                    <X size={18} strokeWidth={2.5} /> Bekor qilish
                  </button>
                )}
              </div>
            </div>
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
