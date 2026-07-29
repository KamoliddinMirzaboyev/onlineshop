import { BarChart3, Coins, PieChart, ReceiptText, Star, TrendingUp, Wallet, Download, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { BusinessReports, StoreBreakdown } from "../types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  if (period === "daily") return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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

function StoreDonut({ stores }: { stores: StoreBreakdown[] }) {
  const total = stores.reduce((s, r) => s + r.revenue, 0);
  const segs = stores.filter((s) => s.revenue > 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let acc = 0;

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
  const [exportOpen, setExportOpen] = useState(false);

  const load = () => {
    setErr(false);
    get<BusinessReports>(`/business/reports?period=${period}`).then(setData).catch(() => setErr(true));
  };

  useEffect(() => { load(); }, [period]);

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text("Barakali Bozor - Hisobot", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`Sana: ${new Date().toLocaleDateString("ru-RU")}`, 14, 30);
    doc.text(`Davr: ${TABS.find(t => t.key === period)?.label}`, 14, 36);

    autoTable(doc, {
      head: [["Sana / Davr", "Buyurtmalar soni", "Tushum (so'm)", "Foyda (so'm)"]],
      body: [...data.series].reverse().map(r => [
        fmtLabel(r.period, period),
        r.orders.toString(),
        money(r.revenue),
        money(r.profit)
      ]),
      startY: 45,
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10, cellPadding: 4 }
    });
    
    autoTable(doc, {
      head: [["Do'kon", "Buyurtmalar", "Tushum (so'm)", "Harajat (so'm)", "Foyda (so'm)"]],
      body: data.stores.map((s) => [s.name, s.orders.toString(), money(s.revenue), money(s.cost), money(s.profit)]),
      startY: (doc as any).lastAutoTable.finalY + 10,
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10, cellPadding: 4 }
    });

    autoTable(doc, {
      head: [["No", "Mahsulot nomi", "Sotilgan miqdor", "Umumiy Tushum (so'm)", "Umumiy Foyda (so'm)"]],
      body: data.top_products.map((t, i) => [
        (i + 1).toString(),
        t.name_uz,
        t.quantity.toString(),
        money(t.revenue),
        money(t.profit)
      ]),
      startY: (doc as any).lastAutoTable.finalY + 10,
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 10, cellPadding: 4 }
    });
    
    doc.save(`Hisobot_${period}_${new Date().toLocaleDateString("ru-RU")}.pdf`);
  };

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    
    const aoa: any[][] = [];
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
    [...data.series].reverse().forEach(r => {
      aoa.push(["", fmtLabel(r.period, period), r.orders, money(r.revenue), money(r.profit)]);
    });
    aoa.push([]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "DO'KONLAR KESIMIDA"]);
    headerRows.add(aoa.length);
    aoa.push(["", "Do'kon", "Buyurtma", "Tushum (so'm)", "Harajat (so'm)", "Foyda (so'm)"]);
    data.stores.forEach((s) => {
      aoa.push(["", s.name, s.orders, money(s.revenue), money(s.cost), money(s.profit)]);
    });
    aoa.push([]);
    aoa.push([]);
    
    sectionRows.add(aoa.length);
    aoa.push(["", "TOP SOTILGAN MAHSULOTLAR REYTINGI"]);
    headerRows.add(aoa.length);
    aoa.push(["", "№", "Mahsulot nomi", "Sotilgan miqdor", "Umumiy Tushum (so'm)", "Umumiy Foyda (so'm)"]);
    data.top_products.forEach((t, i) => {
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

  if (!data) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobot</h1>
          <p className="text-slate-500">Savdo, foyda va do'konlar kesimida tahlil</p>
        </div>
        {err ? <ErrorRetry onRetry={load} /> : <StatCardsSkeleton count={4} />}
      </div>
    );
  }

  const rows = data.series;
  const totOrders = data.totals.orders;
  const totRevenue = data.totals.revenue;
  const totProfit = data.totals.profit;
  const totCost = totRevenue - totProfit;
  const maxQty = Math.max(1, ...data.top_products.map((t) => t.quantity));

  const chartData = rows.map(r => ({
    name: fmtLabel(r.period, period),
    orders: r.orders,
    revenue: r.revenue,
    profit: r.profit
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Hisobot</h1>
            <p className="text-slate-500">Savdo, foyda va do'konlar kesimida tahlil</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-slate-100 p-1 rounded-xl">
              {TABS.map((t) => (
                <button key={t.key}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${period === t.key ? "bg-white text-brand shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => setPeriod(t.key)}>{t.label}</button>
              ))}
            </div>
            
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            
            <div className="relative" onMouseLeave={() => setExportOpen(false)}>
              <div className="flex items-stretch rounded-xl shadow-sm border border-brand bg-brand text-white text-sm font-semibold transition-all hover:shadow-md">
                <button 
                  onClick={exportExcel}
                  className="flex items-center gap-2 pl-4 pr-3 py-2 hover:bg-white/10 transition-colors rounded-l-xl"
                >
                  <Download size={16} /> Yuklab olish
                </button>
                <div className="w-px bg-white/20 my-2" />
                <button 
                  onClick={() => setExportOpen(!exportOpen)} 
                  className="px-2 hover:bg-white/10 transition-colors rounded-r-xl"
                >
                  <ChevronDown size={16} className={`transition-transform ${exportOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5 z-50">
                  <button
                    onClick={() => { exportExcel(); setExportOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand rounded-lg transition-colors"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-500" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => { exportPDF(); setExportOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand rounded-lg transition-colors"
                  >
                    <FileText size={16} className="text-rose-500" />
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
        <div className="flex items-center gap-2 mb-6 font-semibold"><BarChart3 size={18} className="text-brand" /> Savdo dinamikasi</div>
        {rows.length === 0 ? (
          <div className="text-center text-slate-400 py-10">Ma'lumot yo'q</div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: any, name: any) => [
                    name === "Buyurtmalar" ? val : `${money(val)} so'm`,
                    name
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar yAxisId="right" dataKey="orders" name="Buyurtmalar" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="left" dataKey="revenue" name="Tushum" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="left" dataKey="profit" name="Foyda" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Do'konlar kesimida ────────────── */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-1 font-semibold"><PieChart size={18} className="text-brand" /> Do'konlar kesimida</div>
        <p className="text-xs text-slate-400 mb-4">So'nggi tanlangan davr bo'yicha</p>
        <StoreDonut stores={data.stores} />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full">
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
              {data.stores.map((s) => (
                <tr key={s.restaurant_id} className="hover:bg-slate-50/60 border-b border-slate-100 last:border-0 transition-colors">
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
        <div className="flex items-center gap-2 px-4 py-4 font-semibold border-b border-slate-100"><Star size={18} className="text-amber-500" /> Sotilgan mahsulotlar reytingi</div>
        <div className="overflow-x-auto">
          <table className="w-full">
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
              {data.top_products.map((t, i) => (
                <tr key={t.product_id} className="hover:bg-slate-50/60 border-b border-slate-100 last:border-0 transition-colors">
                  <td className="td text-slate-400 font-semibold">{i + 1}</td>
                  <td className="td font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      {t.image_url
                        ? <img src={t.image_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200" />
                        : <span className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{t.name_uz}</div>
                        <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="td font-semibold">{t.quantity}</td>
                  <td className="td">{money(t.revenue)} so'm</td>
                  <td className="td text-emerald-600 font-medium">{money(t.profit)} so'm</td>
                </tr>
              ))}
              {data.top_products.length === 0 && (
                <tr><td colSpan={5} className="td text-center text-slate-400 py-12">Hali sotuv yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
