import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Category, Product } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import OptimizedImage from "../components/OptimizedImage";
import { MenuSkeleton } from "../components/Skeleton";
import { useStore } from "../hooks/useStore";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { goBack } from "../lib/navBack";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

export default function CategoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { t, lang } = useI18n();
  const { store, error, needsLocation, locationIssue, reload } = useStore();
  const cart = useCart();

  const cat: Category | undefined = useMemo(
    () => store?.categories.find((c) => c.id === Number(id)),
    [store, id],
  );

  if (needsLocation) {
    return <LocationNeeded issue={locationIssue} onRetry={reload} />;
  }
  if (error) return <ErrorState onRetry={reload} />;
  if (!store) return <MenuSkeleton />;

  const add = (p: Product) => {
    cart.add(p);
    haptic("light");
  };
  const dec = (p: Product) => {
    const q = cart.lines[p.id]?.quantity ?? 0;
    cart.setQty(p.id, q - 1);
    haptic("light");
  };
  const qtyOf = (p: Product) => cart.lines[p.id]?.quantity ?? 0;

  return (
    <div className="min-h-full bg-tg-bg">
      {/* ── Header banner ──────────────────────────────────────── */}
      <div className="relative h-40 overflow-hidden rounded-b-3xl">
        {cat?.image_url ? (
          <OptimizedImage
            src={cat.image_url}
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        <button
          type="button"
          onClick={() => goBack(nav, pathname)}
          className="absolute top-3 left-3 h-10 w-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition"
          aria-label="Orqaga"
        >
          <ChevronLeft size={22} />
        </button>

        <h1 className="absolute bottom-4 left-4 right-4 text-white text-2xl font-bold drop-shadow-md">
          {cat ? loc(cat, "name", lang) : t.categories}
        </h1>
      </div>

      {/* ── Subcategory sections ──────────────────────────────── */}
      <div className="px-4 py-4 pb-28">
        {(() => {
          const sections = (cat?.subcategories ?? []).filter((sc) => sc.products.length > 0);
          if (sections.length === 0) {
            return <p className="text-center text-tg-hint py-16">{t.empty_category}</p>;
          }
          return sections.map((sc) => (
            <div key={sc.id} className="mb-6 last:mb-0">
              <h2 className="font-bold text-lg mb-3">{loc(sc, "name", lang)}</h2>
              <div className="grid grid-cols-2 gap-3">
                {sc.products.map((p) => (
                  <div key={p.id} className="card border border-black/5">
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
                            <span className="min-w-[3rem] text-center text-[15px] font-extrabold text-slate-900">
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
                      <span className="font-bold text-sm">
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
            </div>
          ));
        })()}
      </div>

      <CartPill />
    </div>
  );
}
