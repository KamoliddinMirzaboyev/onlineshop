import { BarChart3, Coins, PieChart, ReceiptText, Star, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { BusinessReports, PeriodPoint, StoreBreakdown } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

type Period = "daily" | "weekly" | "monthly";
const TABS: { key: Period; label: string }[] = [
  { key: "daily", label: "Kunlik" },
  { key: "weekly", label: "Haftalik" },
  { key: "monthly", label: "Oylik" },
];

// Do'kon segmentlari uchun ranglar (brand + qo'shimchalar). Ro'yxatdan aylanib ishlatiladi.
const STORE_COLORS = ["#16A34A", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444"];

function fmtLabel(iso: string, period: Period) {
  const d = new Date(iso);
  if (period === "monthly") return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function Stat({
  label, value, icon: Icon, tint,
}: { label: string; value: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      </div>
      <span className={`grid place-items-center h-10 w-10 rounded-lg shrink-0 ${tint}`}>
        <Icon size={20} />
      </span>
    </div>
  );
}

// Do'konlar tushumi ulushi — toza SVG donut. Segmentlar strokeDasharray bilan chiziladi.
function StoreDonut({ stores }: { stores: StoreBreakdown[] }) {
  const total = stores.reduce((s, r) => s + r.revenue, 0);
  const segs = stores.filter((s) => s.revenue > 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let acc = 0; // jamlangan yoy uzunligi

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {total > 0 && segs.map((s, i) => {
          const len = (s.revenue / total) * c;
          const el = (
            <circle
              key={s.restaurant_id} cx="50" cy="50" r={r} fill="none"
              stroke={STORE_COLORS[i % STORE_COLORS.length]} strokeWidth="14"
              strokeDasharray={`${len} ${c}`} strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-sm min-w-0 flex-1">
        {segs.map((s, i) => (
          <li key={s.restaurant_id} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: STORE_COLORS[i % STORE_COLORS.length] }} />
            <span className="truncate flex-1">{s.name}</span>
            <span className="text-slate-500 tabular-nums">{Math.round((s.revenue / total) * 100)}%</span>
          </li>
        ))}
        {segs.length === 0 && <li className="text-slate-400">Hali sotuv yo'q</li>}
      </ul>
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<BusinessReports | null>(null);
  const [period, setPeriod] = useState<Period>("daily");
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    get<BusinessReports>("/business/reports").then(setData).catch(() => setErr(true));
  };

  useEffect(() => { load(); }, []);

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobotlar</h1>
        <p className="text-slate-500 mb-6">Savdo, foyda va do'konlar kesimida tahlil</p>
        {err ? <ErrorRetry onRetry={load} /> : <StatCardsSkeleton count={4} />}
      </div>
    );
  }

  const rows: PeriodPoint[] = data[period];
  const totOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totCost = totRevenue - totProfit;
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  const maxQty = Math.max(1, ...data.top_products.map((t) => t.quantity));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobotlar</h1>
      <p className="text-slate-500 mb-6">Savdo, foyda va do'konlar kesimida tahlil</p>

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button key={t.key}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === t.key ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setPeriod(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ── KPI kartalari (tanlangan davr) ─────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Buyurtmalar" value={String(totOrders)} icon={ReceiptText} tint="bg-sky-50 text-sky-600" />
        <Stat label="Tushum" value={`${money(totRevenue)} so'm`} icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
        <Stat label="Harajat" value={`${money(totCost)} so'm`} icon={Coins} tint="bg-amber-50 text-amber-600" />
        <Stat label="Foyda" value={`${money(totProfit)} so'm`} icon={TrendingUp} tint="bg-teal-50 text-teal-600" />
      </div>

      {/* ── Savdo dinamikasi (bar chart) ───────────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 font-semibold"><BarChart3 size={18} /> Savdo dinamikasi</div>
        {rows.length === 0 ? (
          <div className="text-center text-slate-400 py-10">Ma'lumot yo'q</div>
        ) : (
          <div className="flex items-end gap-1.5 h-48 overflow-x-auto">
            {rows.map((r) => (
              <div key={r.period} className="flex-1 min-w-[14px] flex flex-col items-center justify-end group h-full">
                <div className="relative w-full flex flex-col items-center justify-end h-full">
                  <div className="hidden group-hover:block absolute -top-1 -translate-y-full bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                    {money(r.revenue)} • foyda {money(r.profit)}
                  </div>
                  <div className="w-full bg-brand/80 rounded-t" style={{ height: `${(r.revenue / maxRevenue) * 100}%` }} />
                </div>
                <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">{fmtLabel(r.period, period)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Do'konlar kesimida (so'nggi 30 kun) ────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-1 font-semibold"><PieChart size={18} /> Do'konlar kesimida</div>
        <p className="text-xs text-slate-400 mb-4">So'nggi 30 kun • tushum ulushi</p>
        <StoreDonut stores={data.stores} />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Do'kon</th>
                <th className="th">Buyurtma</th>
                <th className="th">Tushum</th>
                <th className="th">Harajat</th>
                <th className="th">Foyda</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s) => (
                <tr key={s.restaurant_id} className="hover:bg-slate-50/60">
                  <td className="td font-medium text-slate-900">{s.name}</td>
                  <td className="td font-semibold">{s.orders}</td>
                  <td className="td">{money(s.revenue)} so'm</td>
                  <td className="td text-amber-600">{money(s.cost)} so'm</td>
                  <td className="td text-emerald-600">{money(s.profit)} so'm</td>
                </tr>
              ))}
              {data.stores.length === 0 && (
                <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali do'kon yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mahsulotlar reytingi (biznes bo'ylab) ──────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 font-semibold border-b border-slate-100"><Star size={18} className="text-amber-500" /> Sotilgan mahsulotlar reytingi</div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">#</th>
              <th className="th">Mahsulot</th>
              <th className="th">Sotildi</th>
              <th className="th">Tushum</th>
              <th className="th">Foyda</th>
            </tr>
          </thead>
          <tbody>
            {data.top_products.map((t, i) => (
              <tr key={t.product_id} className="hover:bg-slate-50/60">
                <td className="td text-slate-400 font-semibold">{i + 1}</td>
                <td className="td font-medium text-slate-900">
                  <div className="flex items-center gap-3">
                    {t.image_url
                      ? <img src={t.image_url} alt="" className="h-8 w-8 rounded-lg object-cover bg-slate-100" />
                      : <span className="h-8 w-8 rounded-lg bg-slate-100" />}
                    <div className="min-w-0 flex-1">
                      <div>{t.name_uz}</div>
                      <div className="h-1.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="td font-semibold">{t.quantity}</td>
                <td className="td">{money(t.revenue)} so'm</td>
                <td className="td text-emerald-600">{money(t.profit)} so'm</td>
              </tr>
            ))}
            {data.top_products.length === 0 && (
              <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali sotuv yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
