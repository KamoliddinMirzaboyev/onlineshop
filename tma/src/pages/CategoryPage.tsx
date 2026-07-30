import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { Category, Subcategory } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import PageHeader from "../components/PageHeader";
import ProductCard from "../components/ProductCard";
import { MenuSkeleton } from "../components/Skeleton";
import { useStore } from "../hooks/useStore";
import { loc, useI18n } from "../i18n";

function ProductGrid({ products }: { products: Subcategory["products"] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 items-stretch">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function SubSection({
  title,
  products,
}: {
  title: string;
  products: Subcategory["products"];
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
        <span className="h-px flex-1 bg-slate-200/80" />
        <span className="text-[11px] font-medium tabular-nums text-slate-400">
          {products.length}
        </span>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}

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

  const title = cat ? loc(cat, "name", lang) : t.categories;
  const withProducts = (cat?.subcategories ?? []).filter((sc) => sc.products.length > 0);

  return (
    <div className="min-h-full bg-tg-bg">
      <PageHeader title={title} back />

      <div className="px-3 pt-3 pb-28">
        {!cat || withProducts.length === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.empty_category}</p>
        ) : (
          withProducts.map((sc) => (
            <SubSection
              key={sc.id}
              title={loc(sc, "name", lang)}
              products={sc.products}
            />
          ))
        )}
      </div>

      <CartPill />
    </div>
  );
}
