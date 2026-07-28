import { Minus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import OptimizedImage from "../components/OptimizedImage";
import { useStore } from "../hooks/useStore";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

export default function SearchPage() {
  const { t, lang } = useI18n();
  const { store, error, needsLocation, locationIssue, reload } = useStore();
  const [q, setQ] = useState("");
  const cart = useCart();

  const all: Product[] = useMemo(
    () => (store?.categories ?? []).flatMap((c) => c.subcategories.flatMap((sc) => sc.products)),
    [store],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (p) =>
        p.name_uz.toLowerCase().includes(needle) ||
        p.name_ru.toLowerCase().includes(needle),
    );
  }, [all, q]);

  const add = (p: Product) => {
    cart.add(p);
    haptic("light");
  };
  const dec = (p: Product) => {
    const qty = cart.lines[p.id]?.quantity ?? 0;
    cart.setQty(p.id, qty - 1);
    haptic("light");
  };
  const qtyOf = (p: Product) => cart.lines[p.id]?.quantity ?? 0;

  if (needsLocation) {
    return <LocationNeeded issue={locationIssue} onRetry={reload} />;
  }
  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="min-h-full bg-tg-bg">
      <div className="sticky top-0 z-20 px-3 pt-2 pb-2 bg-tg-bg">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tg-hint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-2xl bg-tg-card pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-brand/40 transition"
          />
        </div>
      </div>

      <div className="px-3 pb-28 pt-1">
        {results.length === 0 ? (
          <p className="text-center text-tg-hint py-16">
            {q ? "🔍" : ""} {t.empty_category}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((p) => (
              <div key={p.id} className="card flex flex-col">
                <div className="relative h-28 bg-tg-card flex items-center justify-center text-3xl">
                  {p.image_url ? (
                    <OptimizedImage src={p.image_url} className="h-full w-full object-cover" />
                  ) : (
                    "🛒"
                  )}
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                    {qtyOf(p) === 0 ? (
                      <button
                        type="button"
                        onClick={() => add(p)}
                        className="h-11 w-11 rounded-full bg-brand text-white flex items-center justify-center shadow-md shadow-brand/30 active:scale-90 transition"
                      >
                        <Plus size={24} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0 rounded-full bg-white shadow-md shadow-black/10 p-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => dec(p)}
                          className="h-9 w-9 rounded-full text-slate-800 flex items-center justify-center active:scale-90 transition"
                        >
                          <Minus size={20} />
                        </button>
                        <span className="min-w-[3rem] text-center text-sm font-medium text-slate-900">
                          {qtyOf(p)} {p.unit ? unitLabel(p.unit, lang) : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => add(p)}
                          className="h-9 w-9 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition shadow-sm"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-3 pt-6 pb-3">
                  <span className="font-medium text-sm">
                    {money(p.price)} {t.sum}
                  </span>
                  <h3 className="text-sm leading-tight line-clamp-1 mt-0.5">
                    {loc(p, "name", lang)}
                  </h3>
                  {p.unit && <p className="text-xs text-tg-hint mt-0.5">1{unitLabel(p.unit, lang)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CartPill />
    </div>
  );
}
