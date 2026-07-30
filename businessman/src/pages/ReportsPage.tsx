import { BarChart3, Coins, PieChart, ReceiptText, Star, TrendingUp, Wallet, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { BusinessReports, PeriodPoint, StoreBreakdown, TopProduct } from "../types";
import * as XLSX from "xlsx-js-style";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

type Period = "daily" | "weekly" | "monthly";
const TABS: { key: Period; label: string }[] = [
  { key: "daily", label: "Kunlik" },
  { key: "weekly", label: "Haftalik" },
  { key: "monthly", label: "Oylik" },
];

const STORE_COLORS = ["#16A34A", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444"];

function fmtLabel(iso: string, period: Period) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (period === "monthly") return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function normalizeReports(raw: unknown): BusinessReports {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const totalsRaw = (d.totals && typeof d.totals === "object" ? d.totals : {}) as Record<string, unknown>;
  const series = Array.isArray(d.series) ? (d.series as PeriodPoint[]) : [];
  const top_products = Array.isArray(d.top_products) ? (d.top_products as TopProduct[]) : [];
  const stores = Array.isArray(d.stores) ? (d.stores as StoreBreakdown[]) : [];
  return {
    totals: {
      orders: Number(totalsRaw.orders) || 0,
      revenue: Number(totalsRaw.revenue) || 0,
      profit: Number(totalsRaw.profit) || 0,
    },
    series,
    top_products,
    stores,
  };
}

function Stat({
  label, value, icon: Icon, tint,
}: { label: string; value: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1 tracking-tight truncate">{value}</div>
      </div>
      <span className={`grid place-items-center h-10 w-10 rounded-lg shrink-0 ${tint}`}>
        <Icon size={20} />
      </span>
    </div>
  );
}

function StoreDonut({ stores }: { stores: StoreBreakdown[] }) {
  const total = stores.reduce((s, r) => s + (r.revenue || 0), 0);
  const segs = stores.filter((s) => (s.revenue || 0) > 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
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
      <ul className="space-y-1.5 text-sm min-w-0 flex-1 w-full">
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
  const [period, setPeriod] = useState<Period>("monthly");
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<unknown>(`/business/reports?period=${period}`)
      .then((d) => {
        setData(normalizeReports(d));
        setErr(false);
      })
      .catch(() => {
        setData(null);
        setErr(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [period]);

  const series = data?.series ?? [];
  const topProducts = data?.top_products ?? [];
  const stores = data?.stores ?? [];
  const totals = data?.totals ?? { orders: 0, revenue: 0, profit: 0 };
  const totCost = totals.revenue - totals.profit;
  const maxQty = Math.max(1, ...topProducts.map((t) => t.quantity || 0));

  const chartData = useMemo(
    () =>
      series.map((r) => ({
        label: fmtLabel(r.period, period),
        orders: Number(r.orders) || 0,
        revenue: Number(r.revenue) || 0,
        profit: Number(r.profit) || 0,
      })),
    [series, period],
  );

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const aoa: (string | number)[][] = [];
    const sectionRows = new Set<number>();
    const headerRows = new Set<number>();

    aoa.push([`Barakali Bozor - Hisobot`]);
    aoa.push([`Sana: ${new Date().toLocaleDateString("ru-RU")}`]);
    aoa.push([`Davr: ${TABS.find((t) => t.key === period)?.label}`]);
    aoa.push([]);

    sectionRows.add(aoa.length);
    aoa.push(["", "UMUMIY KO'RSATKICHLAR"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Ko'rsatkich", "Qiymat"]);
    aoa.push(["", "Jami Buyurtmalar", `${money(totals.orders)} ta`]);
    aoa.push(["", "Jami Tushum", `${money(totals.revenue)} so'm`]);
    aoa.push(["", "Jami Foyda", `${money(totals.profit)} so'm`]);
    aoa.push([]);
    aoa.push([]);

    sectionRows.add(aoa.length);
    aoa.push(["", "SAVDO DINAMIKASI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Sana / Davr", "Buyurtmalar soni", "Tushum (so'm)", "Foyda (so'm)"]);
    [...series].reverse().forEach((r) => {
      aoa.push(["", fmtLabel(r.period, period), r.orders, money(r.revenue), money(r.profit)]);
    });
    aoa.push([]);
    aoa.push([]);

    sectionRows.add(aoa.length);
    aoa.push(["", "DO'KONLAR KESIMIDA"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Do'kon", "Buyurtma", "Tushum (so'm)", "Harajat (so'm)", "Foyda (so'm)"]);
    stores.forEach((s) => {
      aoa.push(["", s.name, s.orders, money(s.revenue), money(s.cost), money(s.profit)]);
    });
    aoa.push([]);
    aoa.push([]);

    sectionRows.add(aoa.length);
    aoa.push(["", "TOP SOTILGAN MAHSULOTLAR REYTINGI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "№", "Mahsulot nomi", "Sotilgan miqdor", "Umumiy Tushum (so'm)", "Umumiy Foyda (so'm)"]);
    topProducts.forEach((t, i) => {
      aoa.push(["", i + 1, t.name_uz, t.quantity, money(t.revenue), money(t.profit)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ width: 4 }, { width: 25 }, { width: 35 }, { width: 18 }, { width: 25 }, { width: 25 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < aoa[r].length; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        cell.s = { font: { sz: 11, color: { rgb: "334155" } }, alignment: { vertical: "center", horizontal: "center" } };
        if (r === 0) cell.s.font = { sz: 16, bold: true, color: { rgb: "0F172A" } };
        else if (r === 1 || r === 2) {
          cell.s.font = { sz: 11, italic: true, color: { rgb: "64748B" } };
          cell.s.alignment = { horizontal: "left" };
        } else if (sectionRows.has(r)) {
          cell.s.font = { sz: 13, bold: true, color: { rgb: "0F172A" } };
          cell.s.alignment = { horizontal: "left" };
        } else if (headerRows.has(r)) {
          cell.s.font = { sz: 12, bold: true, color: { rgb: "FFFFFF" } };
          cell.s.fill = { fgColor: { rgb: "059669" } };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Hisobot");
    XLSX.writeFile(wb, `Hisobot_${period}_${new Date().toLocaleDateString("ru-RU")}.xlsx`);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobot</h1>
            <p className="text-slate-500">Savdo, foyda va do'konlar kesimida tahlil</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-100 p-1 rounded-xl">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                    period === t.key ? "bg-white text-brand shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  onClick={() => setPeriod(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={exportExcel}
              disabled={!data || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm border border-brand bg-brand text-white text-sm font-semibold transition-all hover:shadow-md hover:bg-brand/90 disabled:opacity-50"
            >
              <Download size={16} /> Yuklab olish
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <StatCardsSkeleton count={4} />
      ) : err || !data ? (
        <ErrorRetry onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat label="Buyurtmalar" value={String(totals.orders)} icon={ReceiptText} tint="bg-sky-50 text-sky-600" />
            <Stat label="Tushum" value={`${money(totals.revenue)} so'm`} icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
            <Stat label="Harajat" value={`${money(totCost)} so'm`} icon={Coins} tint="bg-amber-50 text-amber-600" />
            <Stat label="Foyda" value={`${money(totals.profit)} so'm`} icon={TrendingUp} tint="bg-teal-50 text-teal-600" />
          </div>

          {/* Savdo dinamikasi */}
          <div className="card p-5 md:p-6 mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 font-semibold">
                <BarChart3 size={18} className="text-brand" /> Savdo dinamikasi
              </div>
              <span className="text-xs text-slate-400">
                {TABS.find((t) => t.key === period)?.label}
                {period === "daily" && " · 30 kun"}
                {period === "weekly" && " · 12 hafta"}
                {period === "monthly" && " · 12 oy"}
              </span>
            </div>

            {chartData.length === 0 ? (
              <div className="text-center text-slate-400 py-16">
                <BarChart3 size={36} className="mx-auto mb-3 opacity-30" />
                <div className="font-medium">Ma'lumot yo'q</div>
                <div className="text-sm mt-1">Bu davrda yetkazilgan buyurtmalar topilmadi</div>
              </div>
            ) : (
              <div className="h-80 w-full min-w-0 mt-2">
                <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 12, right: 8, left: 0, bottom: 8 }}
                    barCategoryGap="18%"
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      dy={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="left"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(val: number) =>
                        val >= 1_000_000
                          ? `${(val / 1_000_000).toFixed(1)}M`
                          : val >= 1000
                            ? `${(val / 1000).toFixed(0)}k`
                            : String(val)
                      }
                      width={48}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9", opacity: 0.6 }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.08)",
                        padding: "10px 14px",
                      }}
                      formatter={(value, name) => {
                        const n = Number(value) || 0;
                        const label = String(name ?? "");
                        if (label === "Buyurtmalar") return [n, label];
                        return [`${money(n)} so'm`, label];
                      }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ paddingTop: 16 }}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="orders"
                      name="Buyurtmalar"
                      fill="#F59E0B"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      name="Tushum"
                      fill="#10B981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="profit"
                      name="Foyda"
                      fill="#3B82F6"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Do'konlar */}
          <div className="card p-5 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-1 font-semibold">
              <PieChart size={18} className="text-brand" /> Do'konlar kesimida
            </div>
            <p className="text-xs text-slate-400 mb-4">So'nggi 30 kun</p>
            <StoreDonut stores={stores} />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-100">
                    <th className="th">Do'kon</th>
                    <th className="th">Buyurtma</th>
                    <th className="th">Tushum</th>
                    <th className="th">Harajat</th>
                    <th className="th">Foyda</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.restaurant_id} className="hover:bg-slate-50/60 border-b border-slate-100 last:border-0">
                      <td className="td font-medium text-slate-900">{s.name}</td>
                      <td className="td font-semibold">{s.orders}</td>
                      <td className="td">{money(s.revenue)} so'm</td>
                      <td className="td text-amber-600">{money(s.cost)} so'm</td>
                      <td className="td text-emerald-600">{money(s.profit)} so'm</td>
                    </tr>
                  ))}
                  {stores.length === 0 && (
                    <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali do'kon yo'q</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top products */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-4 font-semibold border-b border-slate-100">
              <Star size={18} className="text-amber-500" /> Sotilgan mahsulotlar reytingi
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="th py-3">#</th>
                    <th className="th py-3">Mahsulot</th>
                    <th className="th py-3">Sotildi</th>
                    <th className="th py-3">Tushum</th>
                    <th className="th py-3">Foyda</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((t, i) => (
                    <tr key={t.product_id} className="hover:bg-slate-50/60 border-b border-slate-100 last:border-0">
                      <td className="td text-slate-400 font-semibold">{i + 1}</td>
                      <td className="td font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          {t.image_url
                            ? <img src={t.image_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200" />
                            : <span className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200" />}
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{t.name_uz}</div>
                            <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${((t.quantity || 0) / maxQty) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="td font-semibold">{t.quantity}</td>
                      <td className="td">{money(t.revenue)} so'm</td>
                      <td className="td text-emerald-600 font-medium">{money(t.profit)} so'm</td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && (
                    <tr><td colSpan={5} className="td text-center text-slate-400 py-12">Hali sotuv yo'q</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
