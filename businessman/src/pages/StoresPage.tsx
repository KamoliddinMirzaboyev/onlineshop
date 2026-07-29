import { BarChart3, CircleCheck, CircleX, Clock, MapPin, Pencil, Plus, Star, Store, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, post, put, withStore } from "../api";
import { confirm } from "../components/Confirm";
import PasswordInput from "../components/PasswordInput";
import { Skeleton } from "../components/Skeleton";
import TrendChart from "../components/TrendChart";
import type {
  BusinessReports, PeriodPoint, Store as StoreT, StoreBreakdown, StoreInput,
  StoreWithStaffInput, TopProduct,
} from "../types";

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

// Tahrirlash formasi — do'kon sozlamalari (yaratishda ishlatilmaydi).
const emptyEdit: StoreInput = {
  name: "",
  address: "",
  owner_name: "",
  phones: [],
  socials: {},
  delivery_fee: 2000,
  min_order: 50_000,
  avg_delivery_minutes: 30,
  is_active: true,
  is_open: true,
};

// Yaratish formasi — do'kon nomi + uni yurituvchi xodim.
const emptyCreate: StoreWithStaffInput = {
  name: "",
  staff_name: "",
  staff_phone: "",
  staff_username: "",
  staff_password: "",
};

export default function StoresPage() {
  const [stores, setStores] = useState<StoreT[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, StoreBreakdown>>({});
  const [trendMap, setTrendMap] = useState<Record<number, PeriodPoint[]>>({});
  const [topMap, setTopMap] = useState<Record<number, TopProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null); // null = yopiq, 0 = yangi
  const [form, setForm] = useState<StoreInput>(emptyEdit);
  const [createForm, setCreateForm] = useState<StoreWithStaffInput>(emptyCreate);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [storeList, reports] = await Promise.all([
        get<StoreT[]>("/business/stores"),
        get<BusinessReports>("/business/reports").catch(() => null),
      ]);
      setStores(storeList);
      if (reports) {
        setStatsMap(Object.fromEntries(reports.stores.map((r) => [r.restaurant_id, r])));
      }

      // Har bir do'kon uchun o'z savdo dinamikasi (kunlik) va top mahsulotlari —
      // /business/reports faqat biznes bo'ylab jamlangan qator beradi.
      const perStore = await Promise.all(
        storeList.map((s) =>
          get<{ daily: PeriodPoint[]; top_products: TopProduct[] }>(withStore("/admin/reports", s.id)).catch(() => null)
        )
      );
      const trend: Record<number, PeriodPoint[]> = {};
      const top: Record<number, TopProduct[]> = {};
      storeList.forEach((s, i) => {
        const r = perStore[i];
        if (r) {
          trend[s.id] = r.daily;
          top[s.id] = r.top_products.slice(0, 3);
        }
      });
      setTrendMap(trend);
      setTopMap(top);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setErr("");
    setCreateForm(emptyCreate);
    setEditId(0);
  };

  const openEdit = (s: StoreT) => {
    setErr("");
    setForm({
      name: s.name,
      address: s.address ?? "",
      owner_name: s.owner_name ?? "",
      phones: s.phones,
      socials: s.socials,
      delivery_fee: s.delivery_fee,
      min_order: s.min_order,
      avg_delivery_minutes: s.avg_delivery_minutes,
      is_active: s.is_active,
      is_open: s.is_open,
    });
    setEditId(s.id);
  };

  const createValid =
    createForm.name.trim() &&
    createForm.staff_name.trim() &&
    createForm.staff_username.trim().length >= 3 &&
    createForm.staff_password.length >= 6;

  const save = async () => {
    setErr("");
    try {
      if (editId) {
        if (!form.name.trim()) return;
        await put(`/business/stores/${editId}`, form);
        toast.success("Do'kon yangilandi");
      } else {
        if (!createValid) return;
        await post("/business/stores", {
          ...createForm,
          staff_phone: createForm.staff_phone?.trim() || null,
        });
        toast.success("Do'kon va xodim yaratildi");
      }
      setEditId(null);
      load();
    } catch (e) {
      const raw = String(e).replace("Error: ", "");
      if (raw.includes("login band")) setErr("Bu login band — boshqa login tanlang");
      else setErr(raw);
    }
  };

  const remove = async (s: StoreT) => {
    const ok = await confirm({
      title: `"${s.name}" do'konni o'chirasizmi?`,
      message: "Bu amalni ortga qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await del<{ archived: boolean }>(`/business/stores/${s.id}`);
      toast.success(
        res.archived
          ? "Buyurtma tarixi bor edi — do'kon nofaol qilindi (tarix saqlanadi)"
          : "Do'kon o'chirildi"
      );
      load();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Do'konlar</h1>
      <p className="text-slate-500 mb-5">Do'konlaringizni qo'shish va boshqarish.</p>

      <div className="flex justify-end mb-4">
        <button className="btn" onClick={openNew}>
          <Plus size={18} /> Yangi do'kon
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5 lg:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/5" /></div>
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : stores.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Store size={28} className="mx-auto mb-2 opacity-30" />
          Hali do'kon yo'q — "Yangi do'kon" tugmasini bosing
        </div>
      ) : (
        <div className="space-y-4">
          {stores.map((s) => {
            const stat = statsMap[s.id];
            const trend = trendMap[s.id];
            const top = topMap[s.id] ?? [];
            return (
              <div key={s.id} className="card p-5 lg:p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* ── Identifikatsiya, holat, ko'rsatkichlar, sozlamalar ── */}
                  <div className="lg:w-72 xl:w-80 shrink-0 lg:pr-6 lg:border-r lg:border-slate-100 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {s.logo_url
                          ? <img src={s.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover bg-slate-100 shrink-0" />
                          : (
                            <span className="grid place-items-center h-12 w-12 rounded-xl bg-brand/10 text-brand font-bold text-lg shrink-0 uppercase">
                              {s.name[0]}
                            </span>
                          )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{s.name}</div>
                          {s.address && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 truncate mt-0.5">
                              <MapPin size={11} className="shrink-0" /> <span className="truncate">{s.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button className="icon-btn" title="Tahrirlash" onClick={() => openEdit(s)}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn hover:text-red-600" title="O'chirish" onClick={() => remove(s)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {s.is_active
                        ? <span className="pill bg-emerald-100 text-emerald-700">Faol</span>
                        : <span className="pill bg-slate-100 text-slate-500">Nofaol</span>}
                      {s.is_open
                        ? <span className="pill bg-sky-100 text-sky-700">Ochiq</span>
                        : <span className="pill bg-amber-100 text-amber-700">Yopiq</span>}
                      {s.rating > 0 && (
                        <span className="pill bg-amber-100 text-amber-700"><Star size={11} className="fill-amber-700" /> {s.rating.toFixed(1)}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <div className="text-xs text-slate-500">Buyurtmalar (30 kun)</div>
                        <div className="text-lg font-bold mt-0.5">{stat ? stat.orders : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Mahsulot turlari</div>
                        <div className="text-lg font-bold mt-0.5">{stat ? stat.product_count : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Aylanma (30 kun)</div>
                        <div className="text-lg font-bold mt-0.5">{stat ? `${money(stat.revenue)} so'm` : "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Foyda (30 kun)</div>
                        <div className="text-lg font-bold mt-0.5 text-emerald-600">{stat ? `${money(stat.profit)} so'm` : "—"}</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400"><Truck size={11} /> /km</div>
                        <div className="text-xs font-semibold text-slate-700 mt-0.5">{money(s.delivery_fee)} so'm</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Bepul dan</div>
                        <div className="text-xs font-semibold text-slate-700 mt-0.5">{money(s.min_order)} so'm</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400"><Clock size={11} /> Vaqt</div>
                        <div className="text-xs font-semibold text-slate-700 mt-0.5">{s.avg_delivery_minutes} daq</div>
                      </div>
                    </div>
                  </div>

                  {/* ── Savdo dinamikasi + eng ko'p sotilganlar ─────────── */}
                  <div className="flex-1 min-w-0 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-3 font-semibold text-sm">
                        <BarChart3 size={16} /> Savdo dinamikasi (30 kun)
                      </div>
                      {trend
                        ? <TrendChart points={trend} compact />
                        : <div className="text-center text-slate-400 py-10 text-sm">Yuklanmoqda...</div>}
                    </div>

                    {top.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3 font-semibold text-sm">
                          <Star size={16} className="text-amber-500" /> Eng ko'p sotilganlar
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {top.map((t) => (
                            <div key={t.product_id} className="flex items-center gap-2 min-w-0">
                              {t.image_url
                                ? <img src={t.image_url} alt="" className="h-8 w-8 rounded-lg object-cover bg-slate-100 shrink-0" />
                                : <span className="h-8 w-8 rounded-lg bg-slate-100 shrink-0" />}
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{t.name_uz}</div>
                                <div className="text-[11px] text-slate-400">{t.quantity} ta sotildi</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editId != null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[28rem] max-w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg">{editId ? "Do'konni tahrirlash" : "Yangi do'kon"}</h2>

            {editId === 0 ? (
              // ── Yaratish: do'kon nomi + xodim (ism, telefon, login, parol) ──
              <>
                <label className="block">
                  <span className="text-xs text-slate-500">Do'kon nomi *</span>
                  <input
                    className="input mt-1"
                    placeholder="Do'kon nomi"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Xodim ismi *</span>
                  <input
                    className="input mt-1"
                    placeholder="Do'konni yurituvchi shaxs"
                    value={createForm.staff_name}
                    onChange={(e) => setCreateForm({ ...createForm, staff_name: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Xodim telefoni</span>
                  <input
                    className="input mt-1"
                    placeholder="+998 90 123 45 67"
                    value={createForm.staff_phone ?? ""}
                    onChange={(e) => setCreateForm({ ...createForm, staff_phone: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Login *</span>
                  <input
                    className="input mt-1"
                    placeholder="Kamida 3 ta belgi"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={createForm.staff_username}
                    onChange={(e) => setCreateForm({ ...createForm, staff_username: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Parol *</span>
                  <PasswordInput
                    className="input mt-1"
                    placeholder="Kamida 6 ta belgi"
                    value={createForm.staff_password}
                    onChange={(e) => setCreateForm({ ...createForm, staff_password: e.target.value })}
                  />
                </label>

                <p className="text-xs text-slate-400">
                  Bu login va parol bilan xodim do'kon paneliga kiradi. Yetkazish narxi
                  va boshqa sozlamalarni keyin "Tahrirlash"dan kiritasiz.
                </p>
              </>
            ) : (
              // ── Tahrirlash: do'kon sozlamalari ──
              <>
                <label className="block">
                  <span className="text-xs text-slate-500">Nomi *</span>
                  <input
                    className="input mt-1"
                    placeholder="Do'kon nomi"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Egasi</span>
                  <input
                    className="input mt-1"
                    value={form.owner_name ?? ""}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-slate-500">1 km narxi (so‘m)</span>
                    <input
                      className="input mt-1"
                      type="number"
                      value={form.delivery_fee}
                      onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Bepul yetkazish dan (so‘m)</span>
                    <input
                      className="input mt-1"
                      type="number"
                      value={form.min_order}
                      onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-500">O'rtacha yetkazish (daqiqa)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    value={form.avg_delivery_minutes}
                    onChange={(e) => setForm({ ...form, avg_delivery_minutes: Number(e.target.value) })}
                  />
                </label>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Faol
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_open}
                      onChange={(e) => setForm({ ...form, is_open: e.target.checked })}
                    />
                    Ochiq
                  </label>
                </div>
              </>
            )}

            {err && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button className="btn-ghost" onClick={() => setEditId(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={editId === 0 ? !createValid : !form.name.trim()}
              >
                <CircleCheck size={16} /> Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
