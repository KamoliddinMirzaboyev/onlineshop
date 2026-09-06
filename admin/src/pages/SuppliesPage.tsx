import { CircleCheck, CircleX, MapPin, Minus, Phone, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { get, post } from "../api";
import { ErrorRetry, OrderListSkeleton } from "../components/Skeleton";
import type { Order, OrderStatus, Product, Restaurant } from "../types";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

const LABEL: Record<OrderStatus, string> = {
  pending: "Yangi", confirmed: "Tasdiqlandi", preparing: "Tayyorlanmoqda",
  ready: "Tayyor", accepted: "Kuryer qabul qildi", delivering: "Yetkazilmoqda",
  delivered: "Yetkazildi", cancelled: "Bekor",
};
const PILL: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700", confirmed: "bg-sky-100 text-sky-700",
  preparing: "bg-indigo-100 text-indigo-700", ready: "bg-violet-100 text-violet-700",
  accepted: "bg-cyan-100 text-cyan-700", delivering: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700", cancelled: "bg-rose-100 text-rose-700",
};

// "+998 90 123 45 67" — faqat 9 raqam kiritiladi, boshi doim +998.
const phoneDigits = (raw: string) => raw.replace(/\D/g, "").replace(/^998/, "").slice(0, 9);
const fmtPhone = (raw: string) => {
  const d = phoneDigits(raw);
  let s = "+998";
  if (d.length) s += " " + d.slice(0, 2);
  if (d.length > 2) s += " " + d.slice(2, 5);
  if (d.length > 5) s += " " + d.slice(5, 7);
  if (d.length > 7) s += " " + d.slice(7, 9);
  return s;
};

export default function SuppliesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setErr(false);
    try {
      const [os, s] = await Promise.all([
        get<Order[]>("/admin/orders?source=manual"),
        get<Restaurant>("/admin/store"),
      ]);
      setOrders(os);
      if (!products.length) {
        setProducts(await get<Product[]>(`/admin/restaurants/${s.id}/products`));
      }
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Qo'lda buyurtmalar</h1>
      <p className="text-slate-500 mb-5">
        Telefon orqali kelgan buyurtmalar — bu yerdan qo'shiladi va kuryerga yuboriladi.
      </p>

      <div className="flex justify-end mb-4">
        <button className="btn" onClick={() => setAdding(true)} disabled={!products.length}>
          <Plus size={18} /> Buyurtma qo'shish
        </button>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? <OrderListSkeleton /> : (
        <div className="space-y-2.5">
          {orders.map((o) => {
            const itemsCount = o.items.reduce((s, it) => s + it.quantity, 0);
            return (
              <div key={o.id} className="card p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-base font-extrabold text-slate-900">№ {o.number}</span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${PILL[o.status]}`}>{LABEL[o.status]}</span>
                  <span className="text-xs font-medium text-slate-400 ml-auto">
                    {new Date(o.created_at).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div className="text-sm text-slate-600 flex items-start gap-2">
                  <MapPin size={15} className="shrink-0 text-slate-400 mt-0.5" />
                  <span>{o.address_line}</span>
                </div>
                {o.phone && (
                  <a href={`tel:${o.phone}`} className="text-sm font-semibold text-slate-700 flex items-center gap-2 mt-1 w-fit hover:text-brand">
                    <Phone size={14} className="text-slate-400" /> {o.phone}
                  </a>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">{itemsCount} dona</span>
                  <span className="font-black text-slate-900">
                    {money(o.total)} <span className="text-xs text-slate-500 font-bold">so'm</span>
                  </span>
                </div>
                {o.assigned_courier_name && (
                  <div className="text-xs text-slate-500 mt-1.5">
                    🚴 {o.assigned_courier_name}
                    {o.assigned_courier_phone ? ` · ${o.assigned_courier_phone}` : ""}
                  </div>
                )}
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="card p-10 text-center text-slate-400">Hali qo'lda buyurtma yo'q</div>
          )}
        </div>
      )}

      {adding && (
        <PhoneOrderModal
          products={products}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success("Buyurtma qo'shildi — kuryerga yuborildi");
            load();
          }}
        />
      )}
    </div>
  );
}

function PhoneOrderModal({
  products,
  onClose,
  onDone,
}: {
  products: Product[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<number, number>>({});
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fee, setFee] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products
      .filter((p) => p.is_available)
      .filter((p) => !s || `${p.name_uz} ${p.name_ru}`.toLowerCase().includes(s));
  }, [products, q]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const setQty = (id: number, n: number) =>
    setSel((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  const lines = Object.entries(sel).map(([id, qty]) => ({ p: byId.get(+id)!, qty }));
  const itemsTotal = lines.reduce((s, l) => s + (l.p?.price ?? 0) * l.qty, 0);
  const valid = lines.length > 0 && phoneDigits(phone).length === 9 && address.trim().length >= 4;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await post("/admin/orders", {
        items: lines.map((l) => ({ product_id: l.p.id, quantity: l.qty })),
        phone: "+998" + phoneDigits(phone),
        address_line: address.trim(),
        delivery_fee: Math.max(0, Math.round(fee) || 0),
        comment: comment.trim() || null,
      });
      onDone();
    } catch {
      toast.error("Buyurtma qo'shilmadi");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="card w-[34rem] max-w-full max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-bold text-lg">Buyurtma qo'shish</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mahsulotlarni tanlang, mijoz ma'lumotini kiriting — yangi buyurtma sifatida
            kuryerga yuboriladi.
          </p>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Qidiruv + mahsulotlar */}
          <div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Mahsulot qidirish..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {list.map((p) => {
                const qty = sel[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name_uz}
                        onClick={() => setZoom(p.image_url!)}
                        className="h-11 w-11 shrink-0 rounded-lg object-cover border border-slate-200 cursor-zoom-in"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-lg">
                        🍽
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate">{p.name_uz}</div>
                      <div className="text-xs text-slate-500">
                        {money(p.price)} so'm / {p.unit}
                      </div>
                    </div>
                    {qty > 0 ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button className="icon-btn" onClick={() => setQty(p.id, qty - 1)}>
                          <Minus size={15} />
                        </button>
                        <input
                          className="w-12 text-center input py-1"
                          value={qty}
                          onChange={(e) => setQty(p.id, Math.max(0, +e.target.value || 0))}
                        />
                        <button className="icon-btn" onClick={() => setQty(p.id, qty + 1)}>
                          <Plus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-ghost shrink-0 px-2.5 py-1 text-xs"
                        onClick={() => setQty(p.id, 1)}
                      >
                        <Plus size={14} /> Qo'shish
                      </button>
                    )}
                  </div>
                );
              })}
              {list.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Topilmadi</div>
              )}
            </div>
          </div>

          {lines.length > 0 && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm space-y-1">
              {lines.map((l) => (
                <div key={l.p.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0 text-slate-600">
                    {l.p.image_url && (
                      <img
                        src={l.p.image_url}
                        alt=""
                        onClick={() => setZoom(l.p.image_url!)}
                        className="h-7 w-7 shrink-0 rounded object-cover border border-slate-200 cursor-zoom-in"
                      />
                    )}
                    <span className="truncate">{l.p.name_uz} × {l.qty}</span>
                  </span>
                  <span className="font-medium shrink-0">{money(l.p.price * l.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                <span>Mahsulotlar</span>
                <span>{money(itemsTotal)} so'm</span>
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-slate-500">Telefon raqam</span>
            <input
              className="input mt-1 font-mono"
              inputMode="numeric"
              placeholder="+998 90 123 45 67"
              value={fmtPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-500">Mijoz manzili</span>
            <input
              className="input mt-1"
              placeholder="Masalan: Chilonzor 5-kvartal, 12-uy"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">Yetkazish narxi (so'm)</span>
              <input
                className="input mt-1"
                type="number"
                min="0"
                value={fee}
                onChange={(e) => setFee(+e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Izoh (ixtiyoriy)</span>
              <input
                className="input mt-1"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-lg bg-brand/5 border border-brand/20 px-3 py-2 text-sm flex justify-between">
            <span className="font-medium text-slate-700">Jami</span>
            <span className="font-bold text-brand">
              {money(itemsTotal + (Math.round(fee) || 0))} so'm
            </span>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-2 justify-end">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            <CircleX size={16} /> Bekor
          </button>
          <button className="btn" onClick={submit} disabled={!valid || busy}>
            <CircleCheck size={16} /> {busy ? "Qo'shilmoqda..." : "Qo'shish"}
          </button>
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
