import { ChevronLeft, CircleCheck, CircleX, MapPin, Minus, Phone, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { get, post } from "../api";
import { ErrorRetry, OrderListSkeleton } from "../components/Skeleton";
import { useInfiniteList } from "../hooks/useInfiniteList";
import type { Category, CategoryGroup, Order, OrderStatus, Product, Restaurant } from "../types";

type Catalog = { cats: Category[]; groups: CategoryGroup[]; products: Product[] };

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

const STATUS_TABS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Barchasi" },
  { value: "pending", label: "Yangi" },
  { value: "accepted", label: "Qabul qilindi" },
  { value: "delivering", label: "Yetkazilmoqda" },
  { value: "delivered", label: "Yetkazildi" },
  { value: "cancelled", label: "Bekor" },
];

const dayLabel = (back: number) => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  return `${back === 0 ? "Bugun" : back === 1 ? "Kecha" : "Kechadan oldin"} · ${date}`;
};
const DAY_TABS: { value: number | null; label: string }[] = [
  { value: null, label: "Barcha kunlar" },
  { value: 0, label: dayLabel(0) },
  { value: 1, label: dayLabel(1) },
  { value: 2, label: dayLabel(2) },
];

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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [day, setDay] = useState<number | null>(null);
  const reqId = useRef(0);

  const load = async () => {
    const my = ++reqId.current;
    const params = new URLSearchParams({ source: "manual", limit: "200" });
    if (status) params.set("status_filter", status);
    if (day !== null) params.set("day", String(day));
    try {
      const os = await get<Order[]>(`/admin/orders?${params}`);
      if (my !== reqId.current) return;
      setOrders(os);
      setErr(false);
      if (!catalog) {
        const s = await get<Restaurant>("/admin/store");
        const [cats, groups, products] = await Promise.all([
          get<Category[]>(`/admin/restaurants/${s.id}/categories`),
          get<CategoryGroup[]>(`/admin/restaurants/${s.id}/category-groups`),
          get<Product[]>(`/admin/restaurants/${s.id}/products`),
        ]);
        setCatalog({ cats, groups, products });
      }
    } catch {
      if (my === reqId.current) setErr(true);
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, day]);

  // Faqat admin qo'shgan (source=manual) buyurtmalar — server filtrига
  // qo'shimcha client kafolati (backend eski bo'lsa ham app buyurtmalar chiqmaydi).
  const manualOnly = useMemo(() => orders.filter((o) => o.source === "manual"), [orders]);
  const { visible, sentinelRef, hasMore } = useInfiniteList(manualOnly, `${status}_${day}`);

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-2rem)] md:h-[calc(100dvh-3.5rem-4rem)]">
      <div className="shrink-0 pb-3">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Qo'lda buyurtmalar</h1>
        <p className="text-slate-500 mb-3">
          Telefon orqali kelgan buyurtmalar — bu yerdan qo'shiladi va kuryerga yuboriladi.
        </p>

        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold flex-shrink-0 transition ${
                status === t.value
                  ? "bg-brand text-white shadow-md shadow-brand/25"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto mt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DAY_TABS.map((t) => (
            <button
              key={String(t.value)}
              onClick={() => setDay(t.value)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold flex-shrink-0 transition ${
                day === t.value
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {err ? (
        <ErrorRetry onRetry={load} />
      ) : loading ? (
        <div className="flex-1 min-h-0 overflow-y-auto"><OrderListSkeleton /></div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pb-20">
          {visible.map((o) => {
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
          {manualOnly.length === 0 && (
            <div className="card p-10 text-center text-slate-400">Qo'lda buyurtma yo'q</div>
          )}
          {hasMore && <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">Yuklanmoqda...</div>}
        </div>
      )}

      <button
        className="btn fixed bottom-6 right-6 z-40 shadow-lg shadow-brand/30"
        onClick={() => setAdding(true)}
        disabled={!catalog}
      >
        <Plus size={18} /> Buyurtma qo'shish
      </button>

      {adding && catalog && (
        <PhoneOrderModal
          catalog={catalog}
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
  catalog,
  onClose,
  onDone,
}: {
  catalog: Catalog;
  onClose: () => void;
  onDone: () => void;
}) {
  const { cats, groups, products } = catalog;
  const [step, setStep] = useState<"catalog" | "customer">("catalog");
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<number, number>>({});
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fee, setFee] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const bySort = (a: { sort_order?: number }, b: { sort_order?: number }) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const avail = useMemo(() => products.filter((p) => p.is_available), [products]);
  const prodsOf = (catId: number) =>
    avail.filter((p) => p.category_id === catId).sort(bySort);
  const subcatsOf = (catId: number) =>
    cats.filter((c) => c.parent_id === catId).sort(bySort);
  const catHasProducts = (catId: number) =>
    prodsOf(catId).length > 0 || subcatsOf(catId).some((sc) => prodsOf(sc.id).length > 0);

  const topCats = useMemo(
    () =>
      cats
        .filter((c) => c.parent_id == null && c.is_active !== false && catHasProducts(c.id))
        .sort(bySort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cats, avail],
  );
  const sections = useMemo(() => {
    const grouped = [...groups].sort(bySort).map((g) => ({
      key: `g${g.id}`,
      title: g.name_uz,
      list: topCats.filter((c) => c.group_id === g.id),
    }));
    const ungrouped = topCats.filter((c) => !groups.some((g) => g.id === c.group_id));
    return [...grouped, { key: "u", title: "", list: ungrouped }].filter((s) => s.list.length);
  }, [groups, topCats]);

  const searchHits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? avail.filter((p) => `${p.name_uz} ${p.name_ru}`.toLowerCase().includes(s)).sort(bySort)
      : [];
  }, [avail, q]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const setQty = (id: number, n: number) =>
    setSel((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  const lines = Object.entries(sel)
    .map(([id, qty]) => ({ p: byId.get(+id)!, qty }))
    .filter((l) => l.p);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const itemsTotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const valid = lines.length > 0 && phoneDigits(phone).length === 9 && address.trim().length >= 4;
  const openedCat = openCat != null ? cats.find((c) => c.id === openCat) : null;

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

  const productCard = (p: Product) => {
    const qty = sel[p.id] ?? 0;
    return (
      <div key={p.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="relative aspect-square bg-slate-100">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name_uz}
              onClick={() => setZoom(p.image_url!)}
              className="w-full h-full object-cover cursor-zoom-in"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🍽</div>
          )}
          {qty > 0 && (
            <span className="absolute top-2 left-2 bg-brand text-white text-xs font-extrabold rounded-lg px-1.5 py-0.5">
              ×{qty}
            </span>
          )}
        </div>
        <div className="p-2.5 flex flex-col gap-1 flex-1">
          <div className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 flex-1">
            {p.name_uz}
          </div>
          <div className="text-xs text-slate-500">{money(p.price)} so'm / {p.unit}</div>
          {qty > 0 ? (
            <div className="flex items-center justify-between mt-1">
              <button className="icon-btn h-9 w-9" onClick={() => setQty(p.id, qty - 1)}>
                <Minus size={16} />
              </button>
              <span className="font-extrabold tabular-nums">{qty}</span>
              <button className="icon-btn h-9 w-9" onClick={() => setQty(p.id, qty + 1)}>
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button className="btn w-full py-1.5 text-xs mt-1" onClick={() => setQty(p.id, 1)}>
              <Plus size={14} /> Qo'shish
            </button>
          )}
        </div>
      </div>
    );
  };

  const productSection = (key: string, title: string, list: Product[]) =>
    list.length ? (
      <section key={key} className="mb-6 last:mb-0">
        {title && (
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] text-slate-400 tabular-nums">{list.length}</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{list.map(productCard)}</div>
      </section>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4">
      <div className="bg-white w-full h-full sm:h-[90vh] sm:max-w-3xl sm:rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-4">
            {step === "customer" ? (
              <button className="icon-btn" onClick={() => setStep("catalog")}>
                <ChevronLeft size={20} />
              </button>
            ) : openCat != null ? (
              <button className="icon-btn" onClick={() => setOpenCat(null)}>
                <ChevronLeft size={20} />
              </button>
            ) : null}
            <h2 className="font-bold text-lg flex-1 truncate">
              {step === "customer"
                ? "Mijoz ma'lumoti"
                : openedCat
                  ? openedCat.name_uz
                  : "Buyurtma qo'shish"}
            </h2>
            <button className="icon-btn" onClick={onClose} disabled={busy}>
              <CircleX size={20} />
            </button>
          </div>
          {step === "catalog" && (
            <div className="px-4 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Barcha mahsulotlardan qidirish..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {step === "customer" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {lines.map((l) => (
                  <div key={l.p.id} className="flex items-center gap-2.5 p-2.5">
                    {l.p.image_url ? (
                      <img src={l.p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">🍽</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate">{l.p.name_uz}</div>
                      <div className="text-xs text-slate-500">
                        {money(l.p.price)} × {l.qty} = {money(l.p.price * l.qty)} so'm
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="icon-btn" onClick={() => setQty(l.p.id, l.qty - 1)}>
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                      <button className="icon-btn" onClick={() => setQty(l.p.id, l.qty + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

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
                  <input className="input mt-1" value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
              </div>
              <div className="rounded-lg bg-brand/5 border border-brand/20 px-3 py-2 text-sm flex justify-between">
                <span className="font-medium text-slate-700">Jami</span>
                <span className="font-bold text-brand">
                  {money(itemsTotal + (Math.round(fee) || 0))} so'm
                </span>
              </div>
            </div>
          ) : q.trim() ? (
            searchHits.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{searchHits.map(productCard)}</div>
            ) : (
              <p className="text-center text-slate-400 py-16">Topilmadi</p>
            )
          ) : openCat == null ? (
            sections.map((sec) => (
              <div key={sec.key} className="mb-6 last:mb-0">
                {sec.title && (
                  <h3 className="text-base font-bold text-slate-800 mb-3">{sec.title}</h3>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sec.list.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setOpenCat(c.id); setQ(""); }}
                      className="relative h-32 sm:h-36 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 text-left active:scale-[0.98] transition"
                    >
                      {c.image_url && (
                        <img src={c.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                      <span className="absolute bottom-2 left-2.5 right-2 text-white font-bold text-[15px] leading-tight line-clamp-2 drop-shadow">
                        {c.name_uz}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <>
              {productSection("direct", "", prodsOf(openCat))}
              {subcatsOf(openCat).map((sc) => productSection(`sc${sc.id}`, sc.name_uz, prodsOf(sc.id)))}
              {!catHasProducts(openCat) && (
                <p className="text-center text-slate-400 py-16">Bu kategoriyada mahsulot yo'q</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {step === "catalog" ? (
          <div className="shrink-0 border-t border-slate-100 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-extrabold">{count}</span>{" "}
              <span className="text-slate-500">mahsulot</span>
              {itemsTotal > 0 && <span className="text-slate-400"> · {money(itemsTotal)} so'm</span>}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => { setOpenCat(null); setQ(""); }}>
                Xaridni davom ettirish
              </button>
              <button className="btn" disabled={!lines.length} onClick={() => setStep("customer")}>
                Rasmiylashtirish
              </button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-slate-100 p-4 flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setStep("catalog")} disabled={busy}>
              <ChevronLeft size={16} /> Mahsulotlar
            </button>
            <button className="btn" onClick={submit} disabled={!valid || busy}>
              <CircleCheck size={16} /> {busy ? "Qo'shilmoqda..." : "Buyurtma qo'shish"}
            </button>
          </div>
        )}
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
