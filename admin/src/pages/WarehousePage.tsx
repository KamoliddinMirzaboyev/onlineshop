import { AlertTriangle, Boxes, CircleCheck, CircleX, Package, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, patch } from "../api";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { Product, Restaurant } from "../types";

function numInput(val: number) { return val === 0 ? "" : String(val); }
function parseNum(s: string) { return s === "" ? 0 : Number(s); }

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [edit, setEdit] = useState<{ id: number; name: string; stock: number; threshold: number; unit: string } | null>(null);

  const load = async () => {
    setErr(false);
    try {
      const s = await get<Restaurant>("/admin/store");
      setProducts(await get<Product[]>(`/admin/restaurants/${s.id}/products`));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    try {
      await patch(`/admin/products/${edit.id}/stock`, {
        stock: edit.stock,
        low_stock_threshold: edit.threshold,
      });
      const name = edit.name;
      setEdit(null);
      toast.success(`"${name}" qoldig'i yangilandi`);
      load();
    } catch {
      toast.error("Saqlab bo'lmadi");
    }
  };

  const total = products.length;
  const low = products.filter((p) => p.stock <= p.low_stock_threshold && p.stock > 0).length;
  const out = products.filter((p) => p.stock <= 0).length;
  const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0);

  const sorted = [...products].sort((a, b) => a.stock - b.stock);

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-2rem)] md:h-[calc(100dvh-3.5rem-4rem)]">
      <div className="shrink-0 pb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Ombor</h1>
        <p className="text-slate-500 mb-4">Qoldiqlarni boshqarish. Buyurtma yetkazilganda qoldiq avtomatik kamayadi.</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card label="Mahsulotlar" value={String(total)} icon={Package} tint="bg-sky-50 text-sky-600" />
          <Card label="Kam qoldiq" value={String(low)} icon={AlertTriangle} tint="bg-amber-50 text-amber-600" />
          <Card label="Tugagan" value={String(out)} icon={CircleX} tint="bg-rose-50 text-rose-600" />
          <Card label="Ombor qiymati" value={`${money(stockValue)} so'm`} icon={Boxes} tint="bg-emerald-50 text-emerald-600" />
        </div>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? (
        <div className="flex-1 min-h-0 overflow-y-auto"><TableSkeleton cols={6} /></div>
      ) : (
      <div className="flex-1 min-h-0 overflow-y-auto pb-2">
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Mahsulot</th>
              <th className="th">Qoldiq</th>
              <th className="th">Birlik</th>
              <th className="th">Chegara</th>
              <th className="th">Holat</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const isOut = p.stock <= 0;
              const isLow = !isOut && p.stock <= p.low_stock_threshold;
              return (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="td font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      {p.image_url
                        ? <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover bg-slate-100" />
                        : <span className="h-9 w-9 rounded-lg bg-slate-100" />}
                      {p.name_uz}
                    </div>
                  </td>
                  <td className="td">
                    <span className={isOut ? "text-rose-600 font-bold" : isLow ? "text-amber-600 font-semibold" : "font-medium"}>{p.stock}</span>
                  </td>
                  <td className="td">
                    <span className="pill bg-slate-100 text-slate-600">{p.unit ?? "dona"}</span>
                  </td>
                  <td className="td text-slate-400">{p.low_stock_threshold}</td>
                  <td className="td">
                    {isOut ? <span className="pill bg-rose-100 text-rose-700">Tugagan</span>
                      : isLow ? <span className="pill bg-amber-100 text-amber-700">Kam qoldi</span>
                      : <span className="pill bg-emerald-100 text-emerald-700">Yetarli</span>}
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost !py-1.5 !px-3 text-sm"
                      onClick={() => setEdit({ id: p.id, name: p.name_uz, stock: p.stock, threshold: p.low_stock_threshold, unit: p.unit ?? "dona" })}>
                      <PackagePlus size={15} /> Qoldiq
                    </button>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-slate-400 py-10">Mahsulot yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
      )}

      {edit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-md">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-xl">Qoldiqni yangilash</h2>
              <p className="text-sm text-slate-400 mt-0.5">{edit.name}</p>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ombor qoldig'i ({edit.unit})
                </label>
                <input className="input text-lg" type="number" min="0" placeholder="0"
                  value={numInput(edit.stock)}
                  onChange={(e) => setEdit({ ...edit, stock: parseNum(e.target.value) })} />
                <div className="flex gap-2 mt-2">
                  {[1, 5, 10, 50, 100].map((n) => (
                    <button key={n} className="btn-ghost !py-1 !px-3 text-sm"
                      onClick={() => setEdit({ ...edit, stock: edit.stock + n })}>+{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kam qoldiq chegarasi ({edit.unit})
                </label>
                <input className="input" type="number" min="0" placeholder="10"
                  value={numInput(edit.threshold)}
                  onChange={(e) => setEdit({ ...edit, threshold: parseNum(e.target.value) })} />
              </div>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl">
              <button className="btn-ghost" onClick={() => setEdit(null)}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={save}><CircleCheck size={16} /> Saqlash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, icon: Icon, tint }: { label: string; value: string; icon: typeof Package; tint: string }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      </div>
      <span className={`grid place-items-center h-10 w-10 rounded-lg ${tint}`}><Icon size={20} /></span>
    </div>
  );
}
