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

// Title rangi yo'q bo'lsa — yumshoq fallback pastel.
const FALLBACK_COLORS = [
  "#E1F3D8",
  "#DCFCE7",
  "#CDE3FC",
  "#FEF9C3",
  "#FCE7F3",
  "#EDE9FE",
];

function resolveBg(hex: string | null | undefined, fallbackIndex: number): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}

/** Kartochka o'lchamiga qarab rasm — katta, pastki-o'ng, to'ldiradi. */
function imageClass(kind: "wide" | "narrow" | "full"): string {
  const base =
    "absolute z-0 pointer-events-none select-none object-contain object-right-bottom drop-shadow-sm";
  if (kind === "narrow") {
    // Kichik card: rasm deyarli butun pastki yarmni egallaydi
    return `${base} bottom-0 right-0 h-[88%] w-[125%] max-w-none -mr-3 -mb-2`;
  }
  if (kind === "full") {
    // To'liq qator: o'ng tomonda katta
    return `${base} bottom-0 right-0 h-[92%] w-[62%] max-w-none -mr-1 -mb-1`;
  }
  // Keng (col-span-3)
  return `${base} bottom-0 right-0 h-[90%] w-[108%] max-w-none -mr-2 -mb-1`;
}

export default function HomePage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { store, loading, error, outOfRange, needsLocation, locationIssue, reload } = useStore();

  const open = (c: Category) => {
    haptic("light");
    nav(`/category/${c.id}`);
  };

  const groups = store?.category_groups ?? [];
  const categories = store?.categories ?? [];
  const sections = [
    ...groups.map((g) => ({
      key: `g${g.id}`,
      title: loc(g, "name", lang),
      bg_color: g.bg_color ?? null,
      cats: categories.filter((c) => c.group_id === g.id),
    })),
    {
      key: "ungrouped",
      title: null as string | null,
      bg_color: null as string | null,
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
            <div key={section.key} className="mb-5 last:mb-0">
              {section.title && (
                <h2 className="text-base font-semibold px-1 mb-3 text-slate-800">{section.title}</h2>
              )}
              <div className="grid grid-cols-5 gap-2.5">
                {section.cats.map((c, ci) => {
                  const isLastAndAlone = ci === section.cats.length - 1 && ci % 2 === 0;
                  const aboveFold = si === 0 && ci < 4;

                  let spanClass = "col-span-5";
                  let kind: "wide" | "narrow" | "full" = "full";
                  if (!isLastAndAlone) {
                    const isEvenRow = Math.floor(ci / 2) % 2 === 0;
                    const isLeft = ci % 2 === 0;
                    if (isEvenRow) {
                      spanClass = isLeft ? "col-span-3" : "col-span-2";
                      kind = isLeft ? "wide" : "narrow";
                    } else {
                      spanClass = isLeft ? "col-span-2" : "col-span-3";
                      kind = isLeft ? "narrow" : "wide";
                    }
                  }

                  const bg = resolveBg(section.bg_color ?? c.bg_color, si * 7 + ci);

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => open(c)}
                      style={{ backgroundColor: bg }}
                      className={`relative h-[200px] sm:h-[220px] rounded-[22px] overflow-hidden text-left active:scale-[0.97] transition-transform ${spanClass}`}
                    >
                      {/* Sarlavha — yuqori chap, rasm ustida o'qiladi */}
                      <h3
                        className={`absolute top-3 left-3 z-10 font-bold text-slate-900 leading-tight ${
                          kind === "full"
                            ? "text-[22px] max-w-[46%]"
                            : kind === "narrow"
                              ? "text-[15px] max-w-[92%] pr-1"
                              : "text-[18px] max-w-[52%]"
                        }`}
                        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.35)" }}
                      >
                        {loc(c, "name", lang)}
                      </h3>

                      {c.image_url ? (
                        <OptimizedImage
                          src={c.image_url}
                          priority={aboveFold}
                          className={imageClass(kind)}
                        />
                      ) : (
                        <ChevronRight
                          size={22}
                          className="absolute bottom-4 right-4 text-slate-500/40"
                        />
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
