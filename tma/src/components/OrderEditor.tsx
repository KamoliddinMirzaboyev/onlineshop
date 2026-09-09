import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { Order, Product, RestaurantDetail } from "../api/types";
import { loc, type Lang } from "../i18n";
import { money, unitLabel } from "../lib/format";
import OptimizedImage from "./OptimizedImage";

interface DraftLine {
  product_id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  price: number;
  unit?: string;
  quantity: number;
  note?: string | null;
}

/** Pending buyurtmani mijoz o'zi tahrirlaydi: miqdor, o'chirish, yangi mahsulot. */
export default function OrderEditor({
  order, store, lang, onClose, onSaved,
}: {
  order: Order;
  store: RestaurantDetail | null;
  lang: Lang;
  onClose: () => void;
  onSaved: (o: Order) => void;
}) {
  const [draft, setDraft] = useState<Record<number, DraftLine>>(() => {
    const d: Record<number, DraftLine> = {};
    for (const it of order.items) {
      d[it.product_id] = {
        product_id: it.product_id, name_uz: it.name_uz, name_ru: it.name_ru,
        image_url: it.image_url, price: it.price, unit: it.unit,
        quantity: it.quantity, note: it.note,
      };
    }
    return d;
  });
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const uz = lang === "uz";
  const lines = Object.values(draft);
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  const allProducts = useMemo(() => {
    if (!store) return [];
    const out: Product[] = [];
    for (const c of store.categories)
      for (const s of c.subcategories)
        for (const p of s.products) if (p.is_available) out.push(p);
    return out;
  }, [store]);

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allProducts;
    return allProducts.filter(
      (p) => p.name_uz.toLowerCase().includes(s) || p.name_ru.toLowerCase().includes(s),
    );
  }, [allProducts, q]);

  const setQty = (pid: number, qty: number) =>
    setDraft((d) => {
      const next = { ...d };
      if (qty <= 0) delete next[pid];
      else next[pid] = { ...next[pid], quantity: qty };
      return next;
    });

  const addProduct = (p: Product) =>
    setDraft((d) => ({
      ...d,
      [p.id]: d[p.id]
        ? { ...d[p.id], quantity: d[p.id].quantity + 1 }
        : {
            product_id: p.id, name_uz: p.name_uz, name_ru: p.name_ru,
            image_url: p.image_url, price: p.price, unit: p.unit, quantity: 1, note: null,
          },
    }));

  const save = async () => {
    if (!lines.length || saving) return;
    setSaving(true);
    setErr("");
    try {
      const updated = await api.editOrder(
        order.id,
        lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, note: l.note ?? null })),
      );
      onSaved(updated);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const m = raw.replace(/^\d+:\s*/, "");
      setErr(
        m ||
          (uz ? "Saqlashda xatolik. Qayta urinib ko'ring." : "Ошибка сохранения. Попробуйте ещё раз."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/5">
          <h2 className="font-semibold">
            {picker
              ? uz ? "Mahsulot qo'shish" : "Добавить товар"
              : uz ? "Buyurtmani tahrirlash" : "Редактировать заказ"}
          </h2>
          <button
            onClick={() => (picker ? setPicker(false) : onClose())}
            className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {picker ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 mb-1">
              <Search size={16} className="text-tg-hint shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={uz ? "Qidirish…" : "Поиск…"}
                className="bg-transparent flex-1 text-sm outline-none"
              />
            </div>
            {found.length === 0 && (
              <p className="text-center text-sm text-tg-hint py-8">
                {uz ? "Topilmadi" : "Ничего не найдено"}
              </p>
            )}
            {found.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="w-full flex items-center gap-3 text-left rounded-xl p-2 active:bg-slate-50"
              >
                {p.image_url ? (
                  <OptimizedImage src={p.image_url} className="h-11 w-11 rounded-lg object-cover bg-slate-100 shrink-0" />
                ) : (
                  <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">🍽</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{loc(p, "name", lang)}</div>
                  <div className="text-xs text-tg-hint">
                    {money(p.price)} {uz ? "so'm" : "сум"}
                    {p.unit ? ` / ${unitLabel(p.unit, lang)}` : ""}
                  </div>
                </div>
                <span className="shrink-0 h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center relative">
                  <Plus size={16} />
                  {draft[p.id] && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {draft[p.id].quantity}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {lines.length === 0 && (
              <p className="text-center text-sm text-tg-hint py-6">
                {uz ? "Kamida bitta mahsulot qoldiring" : "Оставьте хотя бы один товар"}
              </p>
            )}
            {lines.map((l) => (
              <div key={l.product_id} className="flex items-center gap-3">
                {l.image_url ? (
                  <OptimizedImage src={l.image_url} className="h-12 w-12 rounded-xl object-cover bg-tg-card shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-tg-card flex items-center justify-center text-lg shrink-0">🍽</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{loc(l, "name", lang)}</div>
                  <div className="text-xs text-tg-hint">
                    {money(l.price * l.quantity)} {uz ? "so'm" : "сум"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setQty(l.product_id, l.quantity - 1)}
                    className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"
                  >
                    {l.quantity <= 1 ? <Trash2 size={15} className="text-red-500" /> : <Minus size={15} />}
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    onClick={() => setQty(l.product_id, l.quantity + 1)}
                    className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => { setQ(""); setPicker(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-brand/40 text-brand text-sm font-semibold"
            >
              <Plus size={16} /> {uz ? "Mahsulot qo'shish" : "Добавить товар"}
            </button>
          </div>
        )}

        {!picker && (
          <div className="border-t border-black/5 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-tg-hint">{uz ? "Mahsulotlar" : "Товары"}</span>
              <span className="font-semibold tabular-nums">{money(subtotal)} {uz ? "so'm" : "сум"}</span>
            </div>
            <p className="text-xs text-tg-hint">
              {uz
                ? "Yetkazish narxi va yakuniy summa saqlaganda qayta hisoblanadi."
                : "Стоимость доставки и итог пересчитаются после сохранения."}
            </p>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button
              onClick={save}
              disabled={!lines.length || saving}
              className="w-full py-3 rounded-xl bg-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition"
            >
              {saving ? (uz ? "Saqlanmoqda…" : "Сохранение…") : uz ? "Saqlash" : "Сохранить"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
