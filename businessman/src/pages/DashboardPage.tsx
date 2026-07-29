import { BarChart3, Coins, Package, ReceiptText, Star, Store, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { ErrorRetry, StatCardsSkeleton } from "../components/Skeleton";
import TrendChart from "../components/TrendChart";
import type { BusinessReports, StoreBreakdown } from "../types";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

function Stat({
  label, value, icon: Icon, tint,
}: { label: string; value: string; icon: LucideIcon; tint: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`grid place-items-center h-9 w-9 rounded-lg shrink-0 ${tint}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">{value}</div>
    </div>
  );
}

function StoreCard({ s }: { s: StoreBreakdown }) {
  return (
    <div className="card p-5 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex items-center gap-3 lg:w-56 shrink-0">
        <span className="grid place-items-center h-11 w-11 rounded-lg bg-brand/10 text-brand shrink-0">
          <Store size={19} />
        </span>
        <div className="font-semibold text-slate-900 truncate">{s.name}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 flex-1 lg:border-l lg:border-slate-100 lg:pl-5">
        <div>
          <div className="text-xs text-slate-500">Buyurtmalar</div>
          <div className="text-lg font-bold mt-0.5">{s.orders}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Mahsulot turlari</div>
          <div className="text-lg font-bold mt-0.5">{s.product_count}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Aylanma</div>
          <div className="text-lg font-bold mt-0.5">{money(s.revenue)} <span className="text-sm font-medium text-slate-400">so'm</span></div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Foyda</div>
          <div className="text-lg font-bold mt-0.5 text-emerald-600">{money(s.profit)} <span className="text-sm font-medium text-emerald-400">so'm</span></div>
        </div>
      </div>

      {s.top_product_name && (
        <div className="flex items-center gap-2 text-sm min-w-0 lg:w-64 shrink-0 lg:border-l lg:border-slate-100 lg:pl-5">
          <Star size={14} className="text-amber-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-slate-400">Eng ko'p sotilgan</div>
            <div className="font-medium truncate">{s.top_product_name}</div>
          </div>
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
          <Stat label="Aylanma" value={`${money(totRevenue)} so'm`} icon={Wallet} tint="bg-emerald-50 text-emerald-600" />
          <Stat label="Harajat" value={`${money(totCost)} so'm`} icon={Coins} tint="bg-amber-50 text-amber-600" />
          <Stat label="Foyda" value={`${money(totProfit)} so'm`} icon={TrendingUp} tint="bg-teal-50 text-teal-600" />
        </div>

        {/* ── Do'konlar bo'yicha — har bir do'kon uchun kengaytirilgan karta ── */}
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

        {/* ── Savdo dinamikasi ────────────────────────────── */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 font-semibold"><BarChart3 size={18} /> Savdo dinamikasi (30 kun)</div>
          <TrendChart points={data.series} />
        </div>

        {/* ── Eng ko'p sotilgan mahsulotlar (biznes bo'ylab) ─ */}
        {topProducts.length > 0 && (
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 font-semibold"><Package size={18} className="text-amber-500" /> Eng ko'p sotilgan mahsulotlar</div>
            <div className="space-y-3">
              {topProducts.map((t, i) => (
                <div key={t.product_id} className="flex items-center gap-3">
                  <span className="text-slate-400 font-semibold w-4 shrink-0">{i + 1}</span>
                  {t.image_url
                    ? <img src={t.image_url} alt="" className="h-9 w-9 rounded-lg object-cover bg-slate-100 shrink-0" />
                    : <span className="h-9 w-9 rounded-lg bg-slate-100 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name_uz}</div>
                    <div className="h-1.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(t.quantity / maxQty) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-semibold shrink-0">{t.quantity} ta</div>
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
