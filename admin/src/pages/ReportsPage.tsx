import { BarChart3, Star, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { PeriodPoint, ReportsOut } from "../types";
import * as XLSX from "xlsx-js-style";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

type Period = "daily" | "weekly" | "monthly";
const TABS: { key: Period; label: string }[] = [
  { key: "daily", label: "Kunlik" },
  { key: "weekly", label: "Haftalik" },
  { key: "monthly", label: "Oylik" },
];

function fmtLabel(iso: string, period: Period) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (period === "monthly") return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function normalizeReports(d: ReportsOut & Record<string, unknown>, period: Period): ReportsOut {
  // Yangi format: { totals, series, top_products }
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
  // Eski format: { daily, weekly, monthly, top_products }
  const legacy = d as Record<string, PeriodPoint[] | undefined>;
  const rows = (Array.isArray(legacy[period]) ? legacy[period] : Array.isArray(legacy.daily) ? legacy.daily : []) ?? [];
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
  const [period, setPeriod] = useState<Period>("monthly");
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<ReportsOut & Record<string, unknown>>(`/admin/reports?period=${period}`)
      .then((d) => {
        setData(normalizeReports(d ?? ({} as ReportsOut & Record<string, unknown>), period));
        setErr(false);
      })
      .catch(() => {
        setData(null);
        setErr(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [period]);


  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    
    const aoa: (string | number)[][] = [];
    const sectionRows = new Set<number>();
    const headerRows = new Set<number>();
    
    aoa.push([`Barakali Bozor - Hisobot`]);
    aoa.push([`Sana: ${new Date().toLocaleDateString("ru-RU")}`]);
    aoa.push([`Davr: ${TABS.find(t => t.key === period)?.label}`]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "UMUMIY KO'RSATKICHLAR"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Ko'rsatkich", "Qiymat"]);
    aoa.push(["", "Jami Buyurtmalar", `${money(data.totals.orders)} ta`]);
    aoa.push(["", "Jami Tushum", `${money(data.totals.revenue)} so'm`]);
    aoa.push(["", "Jami Foyda", `${money(data.totals.profit)} so'm`]);
    aoa.push([]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "SAVDO DINAMIKASI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Sana / Davr", "Buyurtmalar soni", "Tushum (so'm)", "Foyda (so'm)"]);
    [...(data.series ?? [])].reverse().forEach(r => {
      aoa.push(["", fmtLabel(r.period, period), r.orders, money(r.revenue), money(r.profit)]);
    });
    aoa.push([]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "TOP SOTILGAN MAHSULOTLAR REYTINGI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "№", "Mahsulot nomi", "Sotilgan miqdor", "Umumiy Tushum (so'm)", "Umumiy Foyda (so'm)"]);
    (data.top_products ?? []).forEach((t, i) => {
      aoa.push(["", i + 1, t.name_uz, t.quantity, money(t.revenue), money(t.profit)]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ width: 4 }, { width: 25 }, { width: 35 }, { width: 18 }, { width: 25 }, { width: 25 }];
    
    // Merge title
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
          cell.s.fill = { fgColor: { rgb: "059669" } }; // emerald-600
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
  }


  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobot</h1>
          <p className="text-slate-500">Savdo, foyda va mahsulot reytinglari</p>
        </div>
        
        <div className="flex items-center gap-2">
          {TABS.map((t) => (
            <button key={t.key}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${period === t.key ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setPeriod(t.key)}>{t.label}</button>
          ))}
          
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          
          <button 
            onClick={exportExcel}
            disabled={!data || loading} 
            className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm border border-brand bg-brand text-white text-sm font-semibold transition-all hover:shadow-md hover:bg-brand/90 disabled:opacity-50"
          >
            <Download size={16} /> Yuklab olish
          </button>
        </div>
      </div>

      {loading ? (
        <StatCardsSkeleton count={3} />
      ) : err || !data ? (
        <ErrorRetry onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-5">
              <div className="text-sm text-slate-500">Buyurtmalar</div>
              <div className="text-2xl font-bold mt-1">{money(data.totals?.orders)}</div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-slate-500">Tushum</div>
              <div className="text-2xl font-bold mt-1">{money(data.totals?.revenue)} <span className="text-sm text-slate-400">so'm</span></div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-slate-500">Foyda</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">{money(data.totals?.profit)} <span className="text-sm text-slate-400">so'm</span></div>
            </div>
          </div>

          {/* ── Bar chart ─────────────────────────────────────── */}
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 font-semibold"><BarChart3 size={18} /> Savdo dinamikasi</div>
            {(data.series ?? []).length === 0 ? (
              <div className="text-center text-slate-400 py-10">Ma'lumot yo'q</div>
            ) : (
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data.series ?? []).map(r => ({ ...r, label: fmtLabel(r.period, period) }))} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                      formatter={(value, name) => [money(Number(value) || 0) + (name === 'Buyurtmalar' ? '' : " so'm"), String(name)]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '24px', paddingBottom: '8px' }} />
                    <Bar yAxisId="right" dataKey="orders" name="Buyurtmalar" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar yAxisId="left" dataKey="revenue" name="Tushum" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar yAxisId="left" dataKey="profit" name="Foyda" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Period table ──────────────────────────────────── */}
          <div className="card overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="th">Davr</th>
                    <th className="th">Buyurtma</th>
                    <th className="th">Tushum</th>
                    <th className="th">Foyda</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(data.series ?? [])].reverse().map((r) => (
                    <tr key={r.period} className="hover:bg-slate-50/60">
                      <td className="td font-medium">{fmtLabel(r.period, period)}</td>
                      <td className="td">{r.orders}</td>
                      <td className="td">{money(r.revenue)} so'm</td>
                      <td className="td text-emerald-600 font-medium">{money(r.profit)} so'm</td>
                    </tr>
                  ))}
                  {(data.series ?? []).length === 0 && <tr><td colSpan={4} className="td text-center text-slate-400 py-8">Ma'lumot yo'q</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Top products ──────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 font-semibold border-b border-slate-100"><Star size={18} className="text-amber-500" /> Sotilgan mahsulotlar reytingi</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
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
                  {(data.top_products ?? []).map((t, i) => (
                    <tr key={t.product_id} className="hover:bg-slate-50/60">
                      <td className="td text-slate-400 font-semibold">{i + 1}</td>
                      <td className="td font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          {t.image_url
                            ? <img src={t.image_url} alt="" className="h-8 w-8 rounded-lg object-cover bg-slate-100" />
                            : <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm">🍽</span>}
                          <div className="min-w-0 flex-1">
                            <div>{t.name_uz}</div>
                            <div className="h-1.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: `${(t.quantity / Math.max(1, ...(data.top_products ?? []).map(p => p.quantity))) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="td font-semibold">{t.quantity}</td>
                      <td className="td">{money(t.revenue)} so'm</td>
                      <td className="td text-emerald-600">{money(t.profit)} so'm</td>
                    </tr>
                  ))}
                  {(data.top_products ?? []).length === 0 && (
                    <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali sotuv yo'q</td></tr>
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
