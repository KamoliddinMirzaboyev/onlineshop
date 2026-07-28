import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { Category } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import ProductCard from "../components/ProductCard";
import { MenuSkeleton } from "../components/Skeleton";
import { useStore } from "../hooks/useStore";
import { loc, useI18n } from "../i18n";

export default function CategoryPage() {
  const { id } = useParams();
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

  const sections = (cat?.subcategories ?? []).filter((sc) => sc.products.length > 0);

  return (
    <div className="min-h-full bg-tg-bg">
      <div className="px-3 pt-3 pb-28">
        {sections.length === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.empty_category}</p>
        ) : (
          sections.map((sc) => (
            <div key={sc.id} className="mb-5 last:mb-0">
              {sections.length > 1 && (
                <h2 className="font-semibold text-sm mb-2.5 px-0.5">{loc(sc, "name", lang)}</h2>
              )}
              <div className="grid grid-cols-3 gap-2.5">
                {sc.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <CartPill />
    </div>
  );
}
