import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import PageHeader from "../components/PageHeader";
import ProductCard from "../components/ProductCard";
import { useStore } from "../hooks/useStore";
import { useI18n } from "../i18n";

export default function SearchPage() {
  const { t } = useI18n();
  const { store, error, needsLocation, locationIssue, reload } = useStore();
  const [q, setQ] = useState("");

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

  if (needsLocation) {
    return <LocationNeeded issue={locationIssue} onRetry={reload} />;
  }
  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="min-h-full bg-tg-bg">
      <PageHeader title="Barakali Bozor" />

      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tg-hint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-2xl bg-tg-card pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-brand/40 transition shadow-[0_1px_6px_rgba(15,23,42,0.04)] border border-slate-200/80"
          />
        </div>
      </div>

      <div className="px-3 pb-28 pt-2">
        {results.length === 0 ? (
          <p className="text-center text-tg-hint py-16">
            {q ? "🔍 " : ""}
            {t.empty_category}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      <CartPill />
    </div>
  );
}
