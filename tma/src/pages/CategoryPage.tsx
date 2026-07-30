import { useEffect, useMemo, useRef, useState } from "react";
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
import { haptic } from "../telegram";

/** "Barchasi" yoki bitta sub id. */
type FilterId = "all" | number;

function SubChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 snap-start rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all active:scale-[0.97]",
        active
          ? "bg-brand text-white shadow-[0_4px_14px_rgba(22,163,74,0.28)]"
          : "bg-white text-slate-700 border border-black/[0.06] shadow-[0_1px_4px_rgba(15,23,42,0.04)]",
      ].join(" ")}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={[
            "ml-1.5 tabular-nums text-[11px] font-medium",
            active ? "text-white/80" : "text-slate-400",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

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
  const [filter, setFilter] = useState<FilterId>("all");
  const chipsRef = useRef<HTMLDivElement>(null);

  const cat: Category | undefined = useMemo(
    () => store?.categories.find((c) => c.id === Number(id)),
    [store, id],
  );

  // Kategoriya o'zgaganda filtrni reset.
  useEffect(() => {
    setFilter("all");
    chipsRef.current?.scrollTo({ left: 0 });
  }, [id]);

  if (needsLocation) {
    return <LocationNeeded issue={locationIssue} onRetry={reload} />;
  }
  if (error) return <ErrorState onRetry={reload} />;
  if (!store) return <MenuSkeleton />;

  const title = cat ? loc(cat, "name", lang) : t.categories;
  const subs = cat?.subcategories ?? [];
  const withProducts = subs.filter((sc) => sc.products.length > 0);
  const totalProducts = withProducts.reduce((n, sc) => n + sc.products.length, 0);

  const selectedSub =
    filter === "all" ? null : subs.find((sc) => sc.id === filter) ?? null;

  const select = (next: FilterId) => {
    haptic("light");
    setFilter(next);
  };

  return (
    <div className="min-h-full bg-tg-bg">
      <PageHeader title={title} back />

      {/* Subkategoriya chiplari — 2+ bo'lsa yoki bitta bo'lsa ham ko'rsatamiz */}
      {subs.length > 0 && (
        <div className="sticky top-[3.5rem] z-10 bg-tg-bg/95 backdrop-blur-md border-b border-black/[0.04]">
          <div
            ref={chipsRef}
            className="flex gap-2 overflow-x-auto px-3 py-2.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <SubChip
              active={filter === "all"}
              label={t.all_subs}
              count={totalProducts}
              onClick={() => select("all")}
            />
            {subs.map((sc) => (
              <SubChip
                key={sc.id}
                active={filter === sc.id}
                label={loc(sc, "name", lang)}
                count={sc.products.length}
                onClick={() => select(sc.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-3 pt-3 pb-28">
        {!cat ? (
          <p className="text-center text-tg-hint py-16">{t.empty_category}</p>
        ) : totalProducts === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.empty_category}</p>
        ) : filter === "all" ? (
          withProducts.map((sc) => (
            <SubSection
              key={sc.id}
              title={loc(sc, "name", lang)}
              products={sc.products}
            />
          ))
        ) : selectedSub && selectedSub.products.length > 0 ? (
          <ProductGrid products={selectedSub.products} />
        ) : (
          <p className="text-center text-tg-hint py-16">{t.empty_subcategory}</p>
        )}
      </div>

      <CartPill />
    </div>
  );
}
