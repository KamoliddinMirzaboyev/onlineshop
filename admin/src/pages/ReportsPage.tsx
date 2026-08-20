import { 
  BarChart3, Star, Download, Calendar, TrendingUp, ShoppingBag, 
  DollarSign, Receipt, Percent, Filter
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { PeriodPoint, ReportsOut } from "../types";
import * as XLSX from "xlsx-js-style";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

type PeriodKey = "today" | "yesterday" | "7days" | "this_month" | "30days" | "this_year" | "all" | "custom";

interface FilterTab {
  key: PeriodKey;
  label: string;
}

const TABS: FilterTab[] = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "7days", label: "Oxirgi 7 kun" },
  { key: "this_month", label: "Shu oy" },
  { key: "30days", label: "Oxirgi 30 kun" },
  { key: "this_year", label: "Shu yil" },
  { key: "all", label: "Barchasi" },
];

const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
];

const UZ_MONTHS_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"
];

function fmtLabel(iso: string, period: PeriodKey) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  if (period === "today" || period === "yesterday") {
    // Soatlik format: 14:00
    const h = String(d.getHours()).padStart(2, "0");
    return `${h}:00`;
  }
  
  if (period === "this_year" || period === "all") {
    // Oylik format: Avgust 2026
    return `${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Kunlik format: 20-avg
  const day = d.getDate();
  const month = UZ_MONTHS_SHORT[d.getMonth()];
  return `${day}-${month}`;
}

function normalizeReports(d: ReportsOut & Record<string, unknown>): ReportsOut {
  if (d?.totals && Array.isArray(d.series)) {
    return {
      totals: {
        orders: Number(d.totals.orders) || 0,
        revenue: Number(d.totals.revenue) || 0,
        profit: Number(d.totals.profit) || 0,
      },
      series: d.series,
      top_products: Array.isArray(d.top_products) ? d.top_products : [],
    };
  }
  
  const legacy = d as Record<string, PeriodPoint[] | undefined>;
  const rows = (Array.isArray(legacy.daily) ? legacy.daily : []) ?? [];
  return {
    totals: {
      orders: rows.reduce((s, r) => s + (r.orders || 0), 0),
      revenue: rows.reduce((s, r) => s + (r.revenue || 0), 0),
      profit: rows.reduce((s, r) => s + (r.profit || 0), 0),
    },
    series: rows,
    top_products: Array.isArray(d?.top_products) ? d.top_products : [],
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsOut | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [chartView, setChartView] = useState<"combined" | "finance" | "orders">("combined");
  
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setErr(false);
    setLoading(true);

    let url = `/admin/reports?period=${period}`;
    if (period === "custom" && startDate) {
      url += `&start_date=${startDate}`;
      if (endDate) {
        url += `&end_date=${endDate}`;
      }
    }

    get<ReportsOut & Record<string, unknown>>(url)
      .then((d) => {
        setData(normalizeReports(d ?? ({} as ReportsOut & Record<string, unknown>)));
        setErr(false);
      })
      .catch(() => {
        setData(null);
        setErr(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (period !== "custom") {
      load();
    }
  }, [period]);

  const handleApplyCustomDate = () => {
    if (!startDate) return;
    setPeriod("custom");
    load();
  };

  // Metrikalar
  const { avgCheck, profitMargin } = useMemo(() => {
    const orders = data?.totals?.orders || 0;
    const revenue = data?.totals?.revenue || 0;
    const profit = data?.totals?.profit || 0;

    const avg = orders > 0 ? Math.round(revenue / orders) : 0;
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";

    return { avgCheck: avg, profitMargin: margin };
  }, [data]);

  const periodTitle = useMemo(() => {
    if (period === "custom") {
      return `Maxsus davr: ${startDate || "..."} - ${endDate || "bugun"}`;
    }
    const found = TABS.find(t => t.key === period);
    return found ? found.label : "Davr";
  }, [period, startDate, endDate]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    
    const aoa: (string | number)[][] = [];
    const sectionRows = new Set<number>();
    const headerRows = new Set<number>();
    
    aoa.push([`Barakali Bozor - Savdo va Foyda Hisoboti`]);
    aoa.push([`Sana: ${new Date().toLocaleDateString("ru-RU")}`]);
    aoa.push([`Hisobot davri: ${periodTitle}`]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "ASOSIY KO'RSATKICHLAR"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Ko'rsatkich", "Qiymat", "Izoh"]);
    aoa.push(["", "Yetkazilgan Buyurtmalar", `${money(data.totals.orders)} ta`, "Muvaffaqiyatli"]);
    aoa.push(["", "Umumiy Tushum", `${money(data.totals.revenue)} so'm`, "Jami aylanma"]);
    aoa.push(["", "Sof Foyda", `${money(data.totals.profit)} so'm`, "Kassa daromadi"]);
    aoa.push(["", "O'rtacha Chek", `${money(avgCheck)} so'm`, "Buyurtma boshiga"]);
    aoa.push(["", "Foyda Marjasi", `${profitMargin} %`, "Rentabellik darajasi"]);
    aoa.push([]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "SAVDO DINAMIKASI TAFSILOTLARI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Sana / Davr", "Buyurtmalar soni", "Tushum (so'm)", "Foyda (so'm)", "O'rtacha chek (so'm)"]);
    [...(data.series ?? [])].reverse().forEach(r => {
      const rowAvg = r.orders > 0 ? Math.round(r.revenue / r.orders) : 0;
      aoa.push(["", fmtLabel(r.period, period), r.orders, money(r.revenue), money(r.profit), money(rowAvg)]);
    });
    aoa.push([]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "SOTILGAN MAHSULOTLAR REYTINGI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "№", "Mahsulot nomi", "Sotilgan miqdor", "Umumiy Tushum (so'm)", "Umumiy Foyda (so'm)"]);
    (data.top_products ?? []).forEach((t, i) => {
      aoa.push(["", i + 1, t.name_uz, t.quantity, money(t.revenue), money(t.profit)]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ width: 4 }, { width: 25 }, { width: 35 }, { width: 20 }, { width: 22 }, { width: 22 }];
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    ];

    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < aoa[r].length; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        
        cell.s = { font: { sz: 11, color: { rgb: "334155" } }, alignment: { vertical: "center", horizontal: "center" } };
        
        if (r === 0) {
          cell.s.font = { sz: 16, bold: true, color: { rgb: "0F172A" } };
        } else if (r === 1 || r === 2) {
          cell.s.font = { sz: 11, italic: true, color: { rgb: "64748B" } };
          cell.s.alignment = { horizontal: "left" };
        } else if (sectionRows.has(r)) {
          cell.s.font = { sz: 13, bold: true, color: { rgb: "0F172A" } };
          cell.s.alignment = { horizontal: "left" };
        } else if (headerRows.has(r)) {
          cell.s.font = { sz: 12, bold: true, color: { rgb: "FFFFFF" } };
          cell.s.fill = { fgColor: { rgb: "059669" } };
          cell.s.border = {
            top: { style: "thin", color: { rgb: "047857" } },
            bottom: { style: "thin", color: { rgb: "047857" } },
            left: { style: "thin", color: { rgb: "047857" } },
            right: { style: "thin", color: { rgb: "047857" } }
          };
        } else {
          cell.s.border = {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          };
          if (c > 1 && r > 5) {
             cell.s.alignment = { horizontal: "center" };
          }
        }
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, "Hisobot");
    XLSX.writeFile(wb, `Hisobot_${period}_${new Date().toLocaleDateString("ru-RU")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER VA FILTERLAR ───────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Hisobot va Statistika</h1>
          <p className="text-sm text-slate-500">
            Tanlangan davr: <span className="font-semibold text-brand">{periodTitle}</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 overflow-x-auto max-w-full">
            {TABS.map((t) => {
              const active = period === t.key;
              return (
                <button 
                  key={t.key}
                  className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
                    active 
                      ? "bg-brand text-white shadow-sm" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                  onClick={() => {
                    setShowCustomDate(false);
                    setPeriod(t.key);
                  }}
                >
                  {t.label}
                </button>
              );
            })}

            <button
              onClick={() => setShowCustomDate(!showCustomDate)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap ${
                period === "custom" || showCustomDate
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Calendar size={14} />
              Sana oralig'i
            </button>
          </div>
          
          <button 
            onClick={exportExcel}
            disabled={!data || loading} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm border border-emerald-600 bg-emerald-600 text-white text-sm font-semibold transition-all hover:shadow hover:bg-emerald-700 disabled:opacity-50 ml-auto xl:ml-0"
          >
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {/* ── MAXSUS SANA ORALIG'I TANLASH ────────────────── */}
      {showCustomDate && (
        <div className="flex flex-wrap items-center gap-4 bg-emerald-50/50 border border-emerald-200/60 p-4 rounded-2xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-950">
            <Filter size={16} className="text-brand" />
            <span>Sana oralig'ini tanlang:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Dan:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Gacha:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <button
              onClick={handleApplyCustomDate}
              disabled={!startDate || loading}
              className="bg-brand text-white text-sm font-medium px-4 py-1.5 rounded-lg shadow-sm hover:bg-brand/90 transition disabled:opacity-50"
            >
              Ko'rsatish
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <StatCardsSkeleton count={5} />
      ) : err || !data ? (
        <ErrorRetry onRetry={load} />
      ) : (
        <>
          {/* ── KPI STATISTIKA KARTALARI ─────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Buyurtmalar */}
            <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Buyurtmalar</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{money(data.totals?.orders)} <span className="text-xs font-normal text-slate-400">ta</span></div>
                <div className="text-[11px] text-slate-400 mt-1">Yetkazilgan</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShoppingBag size={24} />
              </div>
            </div>

            {/* Tushum */}
            <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Umumiy Tushum</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{money(data.totals?.revenue)}</div>
                <div className="text-[11px] text-slate-400 mt-1">so'm aylanma</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={24} />
              </div>
            </div>

            {/* Sof Foyda */}
            <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sof Foyda</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">{money(data.totals?.profit)}</div>
                <div className="text-[11px] text-slate-400 mt-1">so'm daromad</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
            </div>

            {/* O'rtacha Chek */}
            <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">O'rtacha Chek</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{money(avgCheck)}</div>
                <div className="text-[11px] text-slate-400 mt-1">so'm / buyurtma</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Receipt size={24} />
              </div>
            </div>

            {/* Foyda Marjasi */}
            <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rentabellik</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">{profitMargin}%</div>
                <div className="text-[11px] text-slate-400 mt-1">foyda marjasi</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Percent size={24} />
              </div>
            </div>
          </div>

          {/* ── GRAFIK (SAVDO DINAMIKASI) ────────────────────── */}
          <div className="card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 font-bold text-lg text-slate-900">
                <BarChart3 size={20} className="text-brand" /> 
                <span>Savdo dinamikasi</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {(data.series ?? []).length} ta davr nuqtasi
                </span>
              </div>

              {/* Grafik ko'rinish filtri */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 text-xs font-medium">
                <button
                  onClick={() => setChartView("combined")}
                  className={`px-3 py-1 rounded-md transition ${chartView === "combined" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Hammasi
                </button>
                <button
                  onClick={() => setChartView("finance")}
                  className={`px-3 py-1 rounded-md transition ${chartView === "finance" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Tushum va Foyda
                </button>
                <button
                  onClick={() => setChartView("orders")}
                  className={`px-3 py-1 rounded-md transition ${chartView === "orders" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Buyurtmalar soni
                </button>
              </div>
            </div>

            {(data.series ?? []).length === 0 ? (
              <div className="text-center text-slate-400 py-16 flex flex-col items-center">
                <BarChart3 size={40} className="text-slate-300 mb-2 stroke-[1.5]" />
                <p>Tanlangan davr uchun hech qanday savdo ma'lumoti topilmadi</p>
              </div>
            ) : (
              <div className="h-88 w-full mt-2">
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart 
                    data={(data.series ?? []).map(r => ({ ...r, label: fmtLabel(r.period, period) }))} 
                    margin={{ top: 15, right: 15, left: 0, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      dy={10}
                    />

                    {/* Chap o'q: Tushum va Foyda (so'm) */}
                    {(chartView === "combined" || chartView === "finance") && (
                      <YAxis 
                        yAxisId="left"
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                      />
                    )}

                    {/* O'ng o'q: Buyurtmalar soni (dona) */}
                    {(chartView === "combined" || chartView === "orders") && (
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#f59e0b', fontSize: 12 }}
                        allowDecimals={false}
                        tickFormatter={(val) => `${val} ta`}
                      />
                    )}

                    <Tooltip 
                      cursor={{ fill: '#f8fafc', opacity: 0.8 }}
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', 
                        padding: '14px 18px',
                        backgroundColor: '#ffffff'
                      }}
                      formatter={(value, name) => [
                        name === 'Buyurtmalar soni' ? `${money(Number(value))} ta` : `${money(Number(value))} so'm`, 
                        String(name)
                      ]}
                      labelFormatter={(label) => `Davr: ${label}`}
                    />

                    <Legend 
                      iconType="circle" 
                      wrapperStyle={{ paddingTop: '20px' }} 
                    />

                    {/* Tushum ustuni */}
                    {(chartView === "combined" || chartView === "finance") && (
                      <Bar 
                        yAxisId="left" 
                        dataKey="revenue" 
                        name="Tushum" 
                        fill="url(#revenueGrad)" 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={32} 
                      />
                    )}

                    {/* Foyda ustuni */}
                    {(chartView === "combined" || chartView === "finance") && (
                      <Bar 
                        yAxisId="left" 
                        dataKey="profit" 
                        name="Foyda" 
                        fill="url(#profitGrad)" 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={32} 
                      />
                    )}

                    {/* Buyurtmalar soni chizig'i */}
                    {(chartView === "combined" || chartView === "orders") && (
                      <Line 
                        yAxisId="right" 
                        type="monotone"
                        dataKey="orders" 
                        name="Buyurtmalar soni" 
                        stroke="#f59e0b" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 6, fill: '#d97706' }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── JADVAL VA TOP MAHSULOTLAR GRID ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Savdo tafsilotlari jadvali (7 ustun) */}
            <div className="lg:col-span-7 card bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Receipt size={18} className="text-slate-500" />
                  <span>Davrlar bo'yicha hisobot</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">Oxirgilari yuqorida</span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3.5 px-4">Davr</th>
                      <th className="py-3.5 px-4 text-center">Buyurtma</th>
                      <th className="py-3.5 px-4 text-right">Tushum</th>
                      <th className="py-3.5 px-4 text-right">Foyda</th>
                      <th className="py-3.5 px-4 text-right">O'rtacha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[...(data.series ?? [])].reverse().map((r, idx) => {
                      const rowAvg = r.orders > 0 ? Math.round(r.revenue / r.orders) : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {fmtLabel(r.period, period)}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                              {r.orders} ta
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                            {money(r.revenue)} <span className="text-[11px] text-slate-400">so'm</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                            {money(r.profit)} <span className="text-[11px] text-emerald-500/80">so'm</span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-500 text-xs">
                            {money(rowAvg)} so'm
                          </td>
                        </tr>
                      );
                    })}
                    {(data.series ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Hech qanday ma'lumot topilmadi
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top sotilgan mahsulotlar (5 ustun) */}
            <div className="lg:col-span-5 card bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Star size={18} className="text-amber-500" />
                  <span>Top mahsulotlar reytingi</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">Sotilgan miqdori bo'yicha</span>
              </div>

              <div className="overflow-y-auto max-h-[500px] divide-y divide-slate-100 flex-1">
                {(data.top_products ?? []).map((t, i) => {
                  const maxQty = Math.max(1, ...(data.top_products ?? []).map(p => p.quantity));
                  const percent = Math.round((t.quantity / maxQty) * 100);

                  return (
                    <div key={t.product_id} className="p-4 hover:bg-slate-50/70 transition flex items-center gap-3">
                      <div className="w-7 text-center font-bold text-xs text-slate-400 shrink-0">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </div>

                      <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60 flex items-center justify-center">
                        {t.image_url ? (
                          <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">🛒</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">{t.name_uz}</span>
                          <span className="text-xs font-bold text-slate-900 shrink-0">{t.quantity} dona</span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div 
                            className="bg-brand h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs mt-1.5">
                          <span className="text-slate-500">Tushum: <b className="text-slate-700">{money(t.revenue)}</b></span>
                          <span className="text-emerald-600 font-semibold">+{money(t.profit)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(data.top_products ?? []).length === 0 && (
                  <div className="py-16 text-center text-slate-400">
                    Hozircha sotilgan mahsulotlar yo'q
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

