import { BarChart3, Coins, Package, ReceiptText, Star, Store, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import TrendChart from "../components/TrendChart";
import { sumFull, sumShort } from "../lib/money";
import type { BusinessReports, StoreBreakdown } from "../types";

/** Stat karta — telefonda 2×2, katta ekranda 4 ustun.
 *  Qiymat ixcham ("12,5 mln"), to'liq son bosib turilganda title'da. */
function Stat({
  label, value, unit, icon: Icon, tint, valueClass = "", title,
}: {
  label: string; value: string; unit?: string; icon: LucideIcon; tint: string; valueClass?: string; title?: string;
}) {
  return (
    <div className="card p-4 sm:p-5" title={title}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[13px] text-slate-500 font-medium">{label}</span>
        <span className={`grid place-items-center h-8 w-8 rounded-lg shrink-0 ${tint}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className={`text-[22px] sm:text-2xl font-bold tracking-tight tabular-nums leading-none ${valueClass}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function Metric({ label, value, unit, valueClass = "" }: { label: string; value: string; unit?: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-[15px] font-bold tabular-nums mt-0.5 truncate ${valueClass}`}>
        {value}{unit && <span className="ml-0.5 text-xs font-medium text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function StoreCard({ s }: { s: StoreBreakdown }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand/10 text-brand shrink-0">
          <Store size={18} />
        </span>
        <div className="font-semibold text-slate-900 truncate">{s.name}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        <Metric label="Buyurtmalar" value={String(s.orders)} />
        <Metric label="Mahsulot turlari" value={String(s.product_count)} />
        <Metric label="Aylanma" value={sumShort(s.revenue)} unit="so'm" />
        <Metric
          label="Foyda"
          value={sumShort(s.profit)}
          unit="so'm"
          valueClass={s.profit < 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {s.top_product_name && (
        <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t border-slate-100">
          <Star size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs text-slate-400 shrink-0">Eng ko'p sotilgan:</span>
          <span className="font-medium truncate">{s.top_product_name}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<BusinessReports | null>(null);
  const [err, setErr] = useState(false);

  const load = () => {
    setErr(false);
    get<BusinessReports>("/business/reports").then(setData).catch(() => setErr(true));
  };

  useEffect(() => { load(); }, []);

  if (err && !data) return <div><Header /><ErrorRetry onRetry={load} /></div>;
  if (!data) return <div><Header /><StatCardsSkeleton /></div>;

  const totOrders = data.stores.reduce((s, r) => s + r.orders, 0);
  const totRevenue = data.stores.reduce((s, r) => s + r.revenue, 0);
  const totCost = data.stores.reduce((s, r) => s + r.cost, 0);
  const totProfit = data.stores.reduce((s, r) => s + r.profit, 0);
  const topProducts = data.top_products.slice(0, 5);
  const maxQty = Math.max(1, ...topProducts.map((t) => t.quantity));

  return (
    <div>
      <Header />

      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat label="Buyurtmalar" value={String(totOrders)} icon={ReceiptText} tint="bg-sky-50 text-sky-600" />
          <Stat label="Aylanma" value={sumShort(totRevenue)} unit="so'm" title={sumFull(totRevenue)}
            icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
          <Stat label="Harajat" value={sumShort(totCost)} unit="so'm" title={sumFull(totCost)}
            icon={Coins} tint="bg-amber-50 text-amber-600" />
          <Stat label="Foyda" value={sumShort(totProfit)} unit="so'm" title={sumFull(totProfit)}
            icon={TrendingUp} tint="bg-teal-50 text-teal-600"
            valueClass={totProfit < 0 ? "text-red-600" : "text-teal-600"} />
        </div>

        {/* ── Do'konlar bo'yicha ── */}
        <div>
          <div className="flex items-center gap-2 mb-3 font-semibold text-lg">
            <Store size={19} /> Do'konlar bo'yicha
          </div>
          <div className="space-y-3">
            {data.stores.map((s) => <StoreCard key={s.restaurant_id} s={s} />)}
            {data.stores.length === 0 && (
              <div className="card p-8 text-center text-slate-400">Hali ma'lumot yo'q</div>
            )}
          </div>
        </div>

        {/* ── Savdo dinamikasi ── */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 font-semibold"><BarChart3 size={18} /> Savdo dinamikasi (30 kun)</div>
          <TrendChart points={data.series} />
        </div>

        {/* ── Eng ko'p sotilgan mahsulotlar ── */}
        {topProducts.length > 0 && (
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 font-semibold"><Package size={18} className="text-amber-500" /> Eng ko'p sotilgan mahsulotlar</div>
            <div className="space-y-3">
              {topProducts.map((t, i) => (
                <div key={t.product_id} className="flex items-center gap-3">
                  <span className="text-slate-400 font-semibold w-4 shrink-0 tabular-nums">{i + 1}</span>
                  {t.image_url
                    ? <img src={t.image_url} alt="" className="h-9 w-9 rounded-lg object-cover bg-slate-100 shrink-0" />
                    : <span className="h-9 w-9 rounded-lg bg-slate-100 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name_uz}</div>
                    <div className="h-1.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold shrink-0 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 tabular-nums">{t.quantity} ta</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Umumiy</h1>
      <p className="text-slate-500 mb-6">So'nggi 30 kun ko'rsatkichlari</p>
    </>
  );
}
