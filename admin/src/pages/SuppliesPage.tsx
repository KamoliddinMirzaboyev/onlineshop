import { CircleCheck, CircleX, Plus, Trash2, TruckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, post } from "../api";
import { confirm } from "../components/Confirm";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { Product, Restaurant, SupplyRecord } from "../types";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");
const today = () => new Date().toISOString().slice(0, 10);

const UNITS = ["kg", "litr", "dona", "quti", "paket", "gramm"];

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<SupplyRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState<{
    product_id: number;
    supplier_name: string;
    quantity: number;
    unit: string;
    cost_per_unit: number;
    supply_date: string;
    notes: string;
  } | null>(null);

  const load = async () => {
    setErr(false);
    try {
      const s = await get<Restaurant>("/admin/store");
      const [prods, recs] = await Promise.all([
        get<Product[]>(`/admin/restaurants/${s.id}/products`),
        get<SupplyRecord[]>("/admin/supplies"),
      ]);
      setProducts(prods);
      setSupplies(recs);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openForm = () => {
    if (!products.length) return;
    setForm({
      product_id: products[0].id,
      supplier_name: "",
      quantity: 1,
      unit: "kg",
      cost_per_unit: 0,
      supply_date: today(),
      notes: "",
    });
  };

  const save = async () => {
    if (!form || !form.supplier_name.trim()) return;
    try {
      await post("/admin/supplies", {
        ...form,
        notes: form.notes || null,
      });
      setForm(null);
      toast.success("Yetkazib berish qo'shildi");
      load();
    } catch {
      toast.error("Saqlab bo'lmadi");
    }
  };

  const remove = async (r: SupplyRecord) => {
    const ok = await confirm({
      title: "Yozuvni o'chirasizmi?",
      message: `${r.product_name} — ${r.supplier_name}. Ombor qoldig'i tegishli miqdorga kamayadi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/admin/supplies/${r.id}`);
      toast.success("Yozuv o'chirildi");
      load();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const totalSpend = supplies.reduce((s, r) => s + r.total_cost, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Yetkazib beruvchilar</h1>
      <p className="text-slate-500 mb-5">
        Kimdan, qanday mahsulot, qancha miqdorda keldi — ombor avtomatik yangilanadi.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card label="Jami yozuv" value={String(supplies.length)} />
        <Card label="Jami xarid" value={`${money(totalSpend)} so'm`} />
        <Card label="Mahsulotlar" value={String(products.length)} />
      </div>

      <div className="flex justify-end mb-4">
        <button className="btn" onClick={openForm} disabled={!products.length}>
          <Plus size={18} /> Yetkazib berish qo'shish
        </button>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={7} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Sana</th>
                <th className="th">Mahsulot</th>
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
                      onClick={() => remove(r)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {supplies.length === 0 && (
                <tr>
                  <td colSpan={8} className="td text-center text-slate-400 py-10">
                    Hali yetkazib berish yozuvi yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────── */}
      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[28rem] max-h-[90vh] overflow-auto space-y-3">
            <h2 className="font-bold text-lg">Yangi yetkazib berish</h2>

            <label className="block">
              <span className="text-xs text-slate-500">Mahsulot</span>
              <select
                className="input mt-1"
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: +e.target.value })}
              >
                {products.map((p) => (
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
              <button className="btn" onClick={save} disabled={!form.supplier_name.trim()}>
                <CircleCheck size={16} /> Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
    </div>
  );
}
