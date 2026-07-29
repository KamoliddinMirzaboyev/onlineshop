import {
  AlertTriangle, Clock, Coins, Package, ReceiptText, ShoppingBag, Star,
  TrendingUp, Users, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import type { DashboardStats } from "../types";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

function Stat({
  label, value, icon: Icon, tint,
}: { label: string; value: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      </div>
      <span className={`grid place-items-center h-10 w-10 rounded-lg ${tint}`}>
        <Icon size={20} />
      </span>
    </div>
  );
}

function PeriodCard({ title, orders, revenue, profit }: { title: string; orders: number; revenue: number; profit: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>
      <div className="space-y-2">
        <Row label="Buyurtma" value={String(orders)} />
        <Row label="Tushum" value={`${money(revenue)} so'm`} />
        <Row label="Foyda" value={`${money(profit)} so'm`} accent />
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`font-bold ${accent ? "text-emerald-600" : ""}`}>{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    get<DashboardStats>("/admin/stats").then(setS).catch(() => setErr(true));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Dashboard</h1>
      <p className="text-slate-500 mb-6">Umumiy ko'rsatkichlar</p>
      {err && !s ? <ErrorRetry onRetry={load} /> : !s ? <StatCardsSkeleton /> : (
      <div className="space-y-6">
        {/* Top stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Bugungi buyurtmalar" value={String(s.orders_today)} icon={ShoppingBag} tint="bg-orange-50 text-orange-600" />
          <Stat label="Bugungi tushum" value={`${money(s.revenue_today)} so'm`} icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
          <Stat label="Bugungi foyda" value={`${money(s.profit_today)} so'm`} icon={Coins} tint="bg-teal-50 text-teal-600" />
          <Stat label="Kutilayotgan" value={String(s.pending_orders)} icon={Clock} tint="bg-amber-50 text-amber-600" />
          <Stat label="Jami buyurtmalar" value={String(s.orders_total)} icon={ReceiptText} tint="bg-sky-50 text-sky-600" />
          <Stat label="Jami tushum" value={`${money(s.revenue_total)} so'm`} icon={TrendingUp} tint="bg-emerald-50 text-emerald-600" />
          <Stat label="Foydalanuvchilar" value={String(s.users_total)} icon={Users} tint="bg-violet-50 text-violet-600" />
          <Stat label="Mahsulotlar" value={String(s.products_total)} icon={Package} tint="bg-indigo-50 text-indigo-600" />
        </div>

        {s.low_stock_count > 0 && (
          <div className="card p-4 flex items-center gap-3 border-amber-200 bg-amber-50">
            <AlertTriangle size={20} className="text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              <b>{s.low_stock_count}</b> ta mahsulot omborda kam qoldi — Ombor bo'limini tekshiring.
            </span>
          </div>
        )}

        {/* Period reports */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Davr bo'yicha hisobot</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PeriodCard title="Bugun" orders={s.orders_today} revenue={s.revenue_today} profit={s.profit_today} />
            <PeriodCard title="So'nggi 7 kun" orders={s.orders_week} revenue={s.revenue_week} profit={s.profit_week} />
            <PeriodCard title="So'nggi 30 kun" orders={s.orders_month} revenue={s.revenue_month} profit={s.profit_month} />
          </div>
        </div>

        {/* Top products */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 font-semibold border-b border-slate-100">
            <Star size={18} className="text-amber-500" /> Eng ko'p sotilgan mahsulotlar
          </div>
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
              {s.top_products.map((t, i) => (
                <tr key={t.product_id} className="hover:bg-slate-50/60">
                  <td className="td text-slate-400 font-semibold">{i + 1}</td>
                  <td className="td font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      {t.image_url
                        ? <img src={t.image_url} alt="" className="h-8 w-8 rounded-lg object-cover bg-slate-100" />
                        : <span className="h-8 w-8 rounded-lg bg-slate-100" />}
                      {t.name_uz}
                    </div>
                  </td>
                  <td className="td font-semibold">{t.quantity}</td>
                  <td className="td">{money(t.revenue)} so'm</td>
                  <td className="td text-emerald-600">{money(t.profit)} so'm</td>
                </tr>
              ))}
              {s.top_products.length === 0 && (
                <tr><td colSpan={5} className="td text-center text-slate-400 py-10">Hali sotuv yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
