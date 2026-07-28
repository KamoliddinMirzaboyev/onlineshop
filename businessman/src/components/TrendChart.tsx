import type { PeriodPoint } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

// Kunlik aylanma — SVG chiziq grafik, pastda aniq son ko'rsatkichlari bilan.
export default function TrendChart({ points, compact = false }: { points: PeriodPoint[]; compact?: boolean }) {
  if (points.length === 0) {
    return <div className="text-center text-slate-400 py-10 text-sm">Ma'lumot yo'q</div>;
  }

  const max = Math.max(1, ...points.map((p) => p.revenue));
  const W = 600;
  const H = 160;
  const pad = 8;
  const stepX = points.length > 1 ? W / (points.length - 1) : 0;
  const coords = points.map((p, i) => [
    i * stepX,
    H - pad - (p.revenue / max) * (H - pad * 2),
  ]);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const total = points.reduce((s, p) => s + p.revenue, 0);
  const avg = Math.round(total / points.length);
  const peak = points.reduce((a, b) => (b.revenue > a.revenue ? b : a), points[0]);

  return (
    <div>
      <div className={`grid grid-cols-3 gap-3 ${compact ? "mb-3" : "mb-5"}`}>
        <div>
          <div className="text-xs text-slate-500">Jami tushum</div>
          <div className={`${compact ? "text-sm" : "text-base sm:text-lg"} font-bold mt-0.5`}>{money(total)} so'm</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">O'rtacha kunlik</div>
          <div className={`${compact ? "text-sm" : "text-base sm:text-lg"} font-bold mt-0.5`}>{money(avg)} so'm</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Eng yuqori kun</div>
          <div className={`${compact ? "text-sm" : "text-base sm:text-lg"} font-bold mt-0.5`}>{money(peak.revenue)} so'm</div>
          <div className="text-[11px] text-slate-400">{fmtDate(peak.period)}</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={compact ? "w-full h-24 sm:h-28" : "w-full h-36 sm:h-44"}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendFill)" stroke="none" />
        <path d={line} fill="none" stroke="#16A34A" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], i) => (
          <circle key={points[i].period} cx={x} cy={y} r="3" fill="#16A34A">
            <title>{`${fmtDate(points[i].period)}: ${money(points[i].revenue)} so'm`}</title>
          </circle>
        ))}
      </svg>

      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
        <span>{fmtDate(points[0].period)}</span>
        <span>{fmtDate(points[points.length - 1].period)}</span>
      </div>
    </div>
  );
}
