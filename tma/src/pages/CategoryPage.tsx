import { ChevronLeft } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Category } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import OptimizedImage from "../components/OptimizedImage";
import ProductCard from "../components/ProductCard";
import { MenuSkeleton } from "../components/Skeleton";
import { useStore } from "../hooks/useStore";
import { loc, useI18n } from "../i18n";
import { goBack } from "../lib/navBack";

export default function CategoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { t, lang } = useI18n();
  const { store, error, needsLocation, locationIssue, reload } = useStore();

  const cat: Category | undefined = useMemo(
    () => store?.categories.find((c) => c.id === Number(id)),
    [store, id],
  );

  if (needsLocation) {
    return <LocationNeeded issue={locationIssue} onRetry={reload} />;
  }
  if (error) return <ErrorState onRetry={reload} />;
  if (!store) return <MenuSkeleton />;

  return (
    <div className="min-h-full bg-tg-bg">
      <div className="relative h-36 overflow-hidden rounded-b-3xl">
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

        <h1 className="absolute bottom-4 left-4 right-4 text-white text-lg font-semibold drop-shadow-md">
          {cat ? loc(cat, "name", lang) : t.categories}
        </h1>
      </div>

      <div className="px-2.5 py-3 pb-28">
        {(() => {
          const sections = (cat?.subcategories ?? []).filter((sc) => sc.products.length > 0);
          if (sections.length === 0) {
            return <p className="text-center text-tg-hint py-16">{t.empty_category}</p>;
          }
          return sections.map((sc) => (
            <div key={sc.id} className="mb-5 last:mb-0">
              <h2 className="font-semibold text-sm mb-2 px-0.5">{loc(sc, "name", lang)}</h2>
              <div className="grid grid-cols-3 gap-2">
                {sc.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
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
