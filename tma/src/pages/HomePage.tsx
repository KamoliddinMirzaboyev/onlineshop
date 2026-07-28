import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Category } from "../api/types";
import CartPill from "../components/CartPill";
import ErrorState from "../components/ErrorState";
import LocationNeeded from "../components/LocationNeeded";
import OptimizedImage from "../components/OptimizedImage";
import PageHeader from "../components/PageHeader";
import { StoreListSkeleton } from "../components/Skeleton";
import { useStore } from "../hooks/useStore";
import { loc, useI18n } from "../i18n";
import { haptic } from "../telegram";

// bg_color yo'q bo'lsa — yumshoq fallback pastel.
const FALLBACK_COLORS = [
  "#E1F3D8",
  "#DCFCE7",
  "#CDE3FC",
  "#FEF9C3",
  "#FCE7F3",
  "#EDE9FE",
];

export default function HomePage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { store, loading, error, outOfRange, needsLocation, locationIssue, reload } = useStore();

  const open = (c: Category) => {
    haptic("light");
    nav(`/category/${c.id}`);
  };

  // Kategoriyalarni Title (group_id) bo'yicha bo'laklarga ajratamiz. Title'i
  // yo'q kategoriyalar sarlavhasiz, ro'yxat oxirida ko'rsatiladi.
  const groups = store?.category_groups ?? [];
  const categories = store?.categories ?? [];
  const sections = [
    ...groups.map((g) => ({
      key: `g${g.id}`,
      title: loc(g, "name", lang),
      cats: categories.filter((c) => c.group_id === g.id),
    })),
    {
      key: "ungrouped",
      title: null as string | null,
      cats: categories.filter((c) => !groups.some((g) => g.id === c.group_id)),
    },
  ].filter((s) => s.cats.length > 0);

  return (
    <div className="min-h-full bg-tg-bg pb-16">
      <PageHeader title="Barakali Bozor" />

      <div className="px-3 pb-4 pt-4">
        {needsLocation ? (
          <LocationNeeded issue={locationIssue} onRetry={reload} />
        ) : outOfRange ? (
          <p className="text-center text-tg-hint py-16 px-4">{t.out_of_range}</p>
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : loading ? (
          <StoreListSkeleton />
        ) : sections.length === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.no_categories}</p>
        ) : (
          sections.map((section, si) => (
            <div key={section.key} className="mb-6 last:mb-0">
              {section.title && <h2 className="text-base font-semibold px-1 mb-3 text-slate-800">{section.title}</h2>}
              <div className="grid grid-cols-5 gap-3">
                {section.cats.map((c, ci) => {
                  const isLastAndAlone = ci === section.cats.length - 1 && ci % 2 === 0;
                  // Birinchi 4 rasm — viewport ichida, lazy emas (LCP).
                  const aboveFold = si === 0 && ci < 4;

                  let spanClass = "col-span-5";
                  if (!isLastAndAlone) {
                    const isEvenRow = Math.floor(ci / 2) % 2 === 0;
                    const isLeft = ci % 2 === 0;
                    if (isEvenRow) {
                      spanClass = isLeft ? "col-span-3" : "col-span-2";
                    } else {
                      spanClass = isLeft ? "col-span-2" : "col-span-3";
                    }
                  }

                  const bg =
                    c.bg_color && /^#[0-9A-Fa-f]{6}$/.test(c.bg_color)
                      ? c.bg_color
                      : FALLBACK_COLORS[(si + ci) % FALLBACK_COLORS.length];

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => open(c)}
                      style={{ backgroundColor: bg }}
                      className={`relative h-[200px] rounded-[24px] overflow-hidden text-left p-4 flex flex-col active:scale-[0.97] transition-transform ${spanClass}`}
                    >
                      <h3
                        className={`relative z-10 font-bold text-slate-900 leading-snug drop-shadow-sm ${
                          isLastAndAlone ? "text-2xl max-w-[55%]" : "text-lg pr-1 max-w-[70%]"
                        }`}
                      >
                        {loc(c, "name", lang)}
                      </h3>
                      {c.image_url ? (
                        <OptimizedImage
                          src={c.image_url}
                          priority={aboveFold}
                          className="absolute bottom-0 right-0 w-[92%] h-[78%] object-contain object-right-bottom z-0 pointer-events-none"
                        />
                      ) : (
                        <ChevronRight size={22} className="absolute bottom-4 right-4 text-slate-500/50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <CartPill />
    </div>
  );
}
