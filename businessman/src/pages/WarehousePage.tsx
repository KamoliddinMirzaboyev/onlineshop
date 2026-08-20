import { AlertTriangle, Boxes, CircleCheck, CircleX, Package, PackagePlus, Plus, Store, Trash2, TruckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, patch, post, withStore } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import { useStore } from "../store";
import type { Product, SupplyRecord } from "../types";

function numInput(val: number) { return val === 0 ? "" : String(val); }
function parseNum(s: string) { return s === "" ? 0 : Number(s); }

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");
const today = () => new Date().toISOString().slice(0, 10);

const UNITS = ["kg", "litr", "dona", "quti", "paket", "gramm"];

type SupplyForm = {
  restaurant_id: number;
  product_id: number;
  supplier_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  supply_date: string;
  notes: string;
};

export default function WarehousePage() {
  const storeId = useStore((s) => s.selectedStoreId);
  const stores = useStore((s) => s.stores);
  const isAll = storeId === "all";
  const storeName = (rid: number) => stores.find((s) => s.id === rid)?.name ?? "—";
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<SupplyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [edit, setEdit] = useState<{ id: number; restaurant_id: number; name: string; stock: number; threshold: number; unit: string } | null>(null);
  const [form, setForm] = useState<SupplyForm | null>(null);

  const load = async (sid: number) => {
    setErr(false);
    try {
      const [prods, recs] = await Promise.all([
        get<Product[]>(withStore(`/admin/restaurants/${sid}/products`, sid)),
        get<SupplyRecord[]>(withStore("/admin/supplies", sid)),
      ]);
      setProducts(prods);
      setSupplies(recs);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    setErr(false);
    try {
      const [prodLists, supLists] = await Promise.all([
        Promise.all(stores.map((s) => get<Product[]>(withStore(`/admin/restaurants/${s.id}/products`, s.id)))),
        Promise.all(stores.map((s) => get<SupplyRecord[]>(withStore("/admin/supplies", s.id)))),
      ]);
      setProducts(prodLists.flat());
      setSupplies(supLists.flat());
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    if (storeId == null) return;
    setLoading(true);
    isAll ? loadAll() : load(storeId);
  };

  useEffect(() => {
    if (storeId == null) return;
    setLoading(true);
    isAll ? loadAll() : load(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, stores.length]);

  const saveStock = async () => {
    if (!edit) return;
    try {
      await patch(withStore(`/admin/products/${edit.id}/stock`, edit.restaurant_id), {
        stock: edit.stock,
        low_stock_threshold: edit.threshold,
      });
      const name = edit.name;
      setEdit(null);
      toast.success(`"${name}" qoldig'i yangilandi`);
      reload();
    } catch {
      toast.error("Saqlab bo'lmadi");
    }
  };

  const openForm = () => {
    if (!products.length) return;
    const rid = isAll ? products[0].restaurant_id : (storeId as number);
    setForm({
      restaurant_id: rid,
      product_id: products.find((p) => p.restaurant_id === rid)?.id ?? products[0].id,
      supplier_name: "",
      quantity: 1,
      unit: "kg",
      cost_per_unit: 0,
      supply_date: today(),
      notes: "",
    });
  };

  const saveSupply = async () => {
    if (!form || !form.supplier_name.trim()) return;
    try {
      const { restaurant_id, ...body } = form;
      await post(withStore("/admin/supplies", restaurant_id), {
        ...body,
        notes: form.notes || null,
      });
      setForm(null);
      toast.success("Yetkazib berish qo'shildi");
      reload();
    } catch {
      toast.error("Saqlab bo'lmadi");
    }
  };

  const removeSupply = async (r: SupplyRecord) => {
    const ok = await confirm({
      title: "Yozuvni o'chirasizmi?",
      message: `${r.product_name} — ${r.supplier_name}. Ombor qoldig'i tegishli miqdorga kamayadi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/supplies/${r.id}`, r.restaurant_id));
      toast.success("Yozuv o'chirildi");
      reload();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const total = products.length;
  const low = products.filter((p) => p.stock <= p.low_stock_threshold && p.stock > 0).length;
  const out = products.filter((p) => p.stock <= 0).length;
  const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
  const totalSpend = supplies.reduce((s, r) => s + r.total_cost, 0);

  const sorted = [...products].sort((a, b) => a.stock - b.stock);

  if (storeId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Ombor</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">
          <Store size={32} className="mx-auto mb-3 opacity-30" />
          Avval "Do'konlar" bo'limida do'kon yarating, so'ng yuqoridagi ro'yxatdan tanlang
        </div>
      </div>
    );
  }

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

      <div className="flex-1 min-h-0 overflow-y-auto pb-2">
      {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={6} /> : (
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Mahsulot</th>
              {isAll && <th className="th">Do'kon</th>}
              <th className="th">Qoldiq</th>
              <th className="th">Birlik</th>
              <th className="th">Chegara</th>
              <th className="th">Tannarx</th>
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
                  {isAll && <td className="td text-slate-500">{storeName(p.restaurant_id)}</td>}
                  <td className="td">
                    <span className={isOut ? "text-rose-600 font-bold" : isLow ? "text-amber-600 font-semibold" : "font-medium"}>{p.stock}</span>
                  </td>
                  <td className="td">
                    <span className="pill bg-slate-100 text-slate-600">{p.unit ?? "dona"}</span>
                  </td>
                  <td className="td text-slate-400">{p.low_stock_threshold}</td>
                  <td className="td">{money(p.cost)} so'm</td>
                  <td className="td">
                    {isOut ? <span className="pill bg-rose-100 text-rose-700">Tugagan</span>
                      : isLow ? <span className="pill bg-amber-100 text-amber-700">Kam qoldi</span>
                      : <span className="pill bg-emerald-100 text-emerald-700">Yetarli</span>}
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost !py-1.5 !px-3 text-sm"
                      onClick={() => setEdit({ id: p.id, restaurant_id: p.restaurant_id, name: p.name_uz, stock: p.stock, threshold: p.low_stock_threshold, unit: p.unit ?? "dona" })}>
                      <PackagePlus size={15} /> Qoldiq
                    </button>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={isAll ? 8 : 7} className="td text-center text-slate-400 py-10">Mahsulot yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ── SUPPLIES ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-10 mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Yetkazib berishlar</h2>
          <p className="text-slate-500 text-sm">Kimdan, qancha keldi — ombor avtomatik yangilanadi.</p>
        </div>
        <button className="btn" onClick={openForm} disabled={!products.length}>
          <Plus size={18} /> Yangi yetkazib berish
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MiniCard label="Jami yozuv" value={String(supplies.length)} />
        <MiniCard label="Jami xarid" value={`${money(totalSpend)} so'm`} />
        <MiniCard label="Mahsulotlar" value={String(products.length)} />
      </div>

      {err ? null : loading ? <TableSkeleton cols={7} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Sana</th>
                <th className="th">Mahsulot</th>
                {isAll && <th className="th">Do'kon</th>}
                <th className="th">Yetkazuvchi</th>
                <th className="th">Miqdor</th>
                <th className="th">Narx/birlik</th>
                <th className="th">Jami</th>
                <th className="th">Izoh</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="td text-slate-500 text-sm">{r.supply_date}</td>
                  <td className="td font-medium text-slate-900">{r.product_name}</td>
                  {isAll && <td className="td text-slate-500">{storeName(r.restaurant_id)}</td>}
                  <td className="td">
                    <span className="flex items-center gap-1.5">
                      <TruckIcon size={14} className="text-slate-400" />
                      {r.supplier_name}
                    </span>
                  </td>
                  <td className="td font-semibold">{r.quantity} {r.unit}</td>
                  <td className="td">{money(r.cost_per_unit)} so'm</td>
                  <td className="td font-semibold text-emerald-700">{money(r.total_cost)} so'm</td>
                  <td className="td text-slate-400 text-sm max-w-[140px] truncate">{r.notes ?? "—"}</td>
                  <td className="td text-right">
                    <button
                      className="icon-btn hover:text-red-600"
                      title="O'chirish"
                      onClick={() => removeSupply(r)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {supplies.length === 0 && (
                <tr>
                  <td colSpan={isAll ? 9 : 8} className="td text-center text-slate-400 py-10">
                    Hali yetkazib berish yozuvi yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* ── STOCK MODAL ──────────────────────────────────── */}
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
              <button className="btn px-6" onClick={saveStock}><CircleCheck size={16} /> Saqlash</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPPLY FORM MODAL ────────────────────────────── */}
      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[28rem] max-w-full max-h-[90vh] overflow-auto space-y-3">
            <h2 className="font-bold text-lg">Yangi yetkazib berish</h2>

            {isAll && (
              <label className="block">
                <span className="text-xs text-slate-500">Do'kon</span>
                <select
                  className="input mt-1"
                  value={form.restaurant_id}
                  onChange={(e) => {
                    const rid = Number(e.target.value);
                    const firstProduct = products.find((p) => p.restaurant_id === rid);
                    setForm({ ...form, restaurant_id: rid, product_id: firstProduct?.id ?? form.product_id });
                  }}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-xs text-slate-500">Mahsulot</span>
              <select
                className="input mt-1"
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: +e.target.value })}
              >
                {products.filter((p) => p.restaurant_id === form.restaurant_id).map((p) => (
                  <option key={p.id} value={p.id}>{p.name_uz}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Yetkazib beruvchi ismi</span>
              <input
                className="input mt-1"
                placeholder="Masalan: Alijоn, Bozor, Fermer..."
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">Miqdor</span>
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: +e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">O'lchov birligi</span>
                <select
                  className="input mt-1"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-slate-500">Narx (1 {form.unit} uchun, so'm)</span>
              <input
                className="input mt-1"
                type="number"
                min="0"
                value={form.cost_per_unit}
                onChange={(e) => setForm({ ...form, cost_per_unit: +e.target.value })}
              />
            </label>

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              Jami xarajat:{" "}
              <span className="font-bold text-emerald-700">
                {money(Math.round(form.quantity * form.cost_per_unit))} so'm
              </span>
            </div>

            <label className="block">
              <span className="text-xs text-slate-500">Sana</span>
              <input
                className="input mt-1"
                type="date"
                value={form.supply_date}
                onChange={(e) => setForm({ ...form, supply_date: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Izoh (ixtiyoriy)</span>
              <input
                className="input mt-1"
                placeholder="Masalan: sifatli, yangi hosildan..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button className="btn" onClick={saveSupply} disabled={!form.supplier_name.trim()}>
                <CircleCheck size={16} /> Saqlash
              </button>
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

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
    </div>
  );
}
