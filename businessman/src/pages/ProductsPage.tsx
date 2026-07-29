import { CircleCheck, CircleX, FolderTree, Heading, Pencil, Plus, Search, ShoppingBasket, Store, Tags, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, post, put, withStore } from "../api";
import ColorPicker from "../components/ColorPicker";
import { confirm } from "../components/Confirm";
import ImageUpload from "../components/ImageUpload";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import { DEFAULT_CATEGORY_COLOR } from "../lib/softColors";
import { useStore } from "../store";
import type { Category, CategoryGroup, Product } from "../types";

type Tab = "products" | "subcategories" | "groups" | "categories";
const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

const UNITS = [
  { value: "dona",   label: "Dona (шт)" },
  { value: "kg",     label: "Kilogram (кг)" },
  { value: "g",      label: "Gramm (г)" },
  { value: "litr",   label: "Litr (л)" },
  { value: "ml",     label: "Millilitr (мл)" },
  { value: "pachka", label: "Pachka (пачка)" },
  { value: "quti",   label: "Quti (коробка)" },
  { value: "xalta",  label: "Xalta (мешок)" },
  { value: "juft",   label: "Juft (пара)" },
  { value: "metr",   label: "Metr (м)" },
];

function numInput(val: number | undefined) {
  if (val === 0 || val === undefined) return "";
  const [int, dec] = String(val).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}
function parseNum(s: string) {
  const cleaned = s.replace(/[^\d.]/g, "");
  return cleaned === "" ? 0 : Number(cleaned);
}

export default function ProductsPage() {
  const storeId = useStore((s) => s.selectedStoreId);
  const stores = useStore((s) => s.stores);
  const setSelectedStore = useStore((s) => s.setSelectedStore);
  const isAll = storeId === "all";
  const storeName = (rid: number) => stores.find((s) => s.id === rid)?.name ?? "—";
  const [tab, setTab] = useState<Tab>("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [editSubcat, setEditSubcat] = useState<Partial<Category> | null>(null);
  const [editGroup, setEditGroup] = useState<Partial<CategoryGroup> | null>(null);
  const [quickSub, setQuickSub] = useState<Partial<Category> | null>(null);
  // Mahsulot modalidagi Kategoriya tanlovi — subkategoriyasi bo'sh bo'lganda ham
  // tanlov "yopishib qolishi" uchun alohida saqlanadi (faqat derivatsiyaga tayanmaydi).
  const [topOverride, setTopOverride] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<number | "all">("all");

  const loadData = async (sid: number) => {
    setErr(false);
    try {
      setCategories(await get<Category[]>(withStore(`/admin/restaurants/${sid}/categories`, sid)));
      setGroups(await get<CategoryGroup[]>(withStore(`/admin/restaurants/${sid}/category-groups`, sid)));
      setProducts(await get<Product[]>(withStore(`/admin/restaurants/${sid}/products`, sid)));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  // "Barcha do'konlar" — faqat ko'rish uchun jamlangan mahsulot+kategoriya
  // ro'yxati. Kategoriya ID'lari bazada global noyob, shu sababli birlashtirish
  // xavfsiz — lekin tahrirlash/yaratish aniq do'kon talab qiladi (FK mos kelishi
  // shart), shuning uchun bu rejimda o'chirilgan.
  const loadAll = async () => {
    setErr(false);
    try {
      const [prodLists, catLists] = await Promise.all([
        Promise.all(stores.map((s) => get<Product[]>(withStore(`/admin/restaurants/${s.id}/products`, s.id)))),
        Promise.all(stores.map((s) => get<Category[]>(withStore(`/admin/restaurants/${s.id}/categories`, s.id)))),
      ]);
      setProducts(prodLists.flat());
      setCategories(catLists.flat());
      setGroups([]);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    if (storeId == null) return;
    setLoading(true);
    isAll ? loadAll() : loadData(storeId);
  };

  useEffect(() => {
    if (storeId == null) return;
    setLoading(true);
    isAll ? loadAll() : loadData(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, stores.length]);

  const saveProduct = async () => {
    if (!editing || storeId == null || isAll || saving) return;
    setSaving(true);
    try {
      const body = {
        category_id: editing.category_id,
        name_uz: editing.name_uz ?? "",
        name_ru: editing.name_ru ?? editing.name_uz ?? "",
        description_uz: editing.description_uz ?? "",
        description_ru: editing.description_ru ?? "",
        image_url: editing.image_url ?? null,
        price: editing.price ?? 0,
        cost: editing.cost ?? 0,
        stock: editing.stock ?? 0,
        unit: editing.unit ?? "kg",
        low_stock_threshold: editing.low_stock_threshold ?? 10,
        is_available: editing.is_available ?? true,
        sort_order: editing.sort_order ?? 0,
      };
      if (editing.id) await put(withStore(`/admin/products/${editing.id}`, storeId), body);
      else await post(withStore("/admin/products", storeId), body);
      const isEdit = !!editing.id;
      setEditing(null);
      await loadData(storeId);
      toast.success(isEdit ? "Mahsulot yangilandi" : "Mahsulot qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (p: Product) => {
    if (storeId == null || isAll) return;
    const ok = await confirm({
      title: `"${p.name_uz}" o'chirilsinmi?`,
      message: "Mahsulot ro'yxatdan olib tashlanadi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/products/${p.id}`, storeId));
      await loadData(storeId);
      toast.success("Mahsulot o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const saveGroup = async () => {
    if (!editGroup || storeId == null || isAll || !editGroup.name_uz?.trim() || saving) return;
    setSaving(true);
    try {
      const body = {
        name_uz: editGroup.name_uz,
        name_ru: editGroup.name_ru || editGroup.name_uz,
        bg_color: editGroup.bg_color ?? DEFAULT_CATEGORY_COLOR,
        sort_order: editGroup.sort_order ?? groups.length,
      };
      if (editGroup.id) await put(withStore(`/admin/category-groups/${editGroup.id}`, storeId), body);
      else await post(withStore("/admin/category-groups", storeId), body);
      const isEdit = !!editGroup.id;
      setEditGroup(null);
      await loadData(storeId);
      toast.success(isEdit ? "Title yangilandi" : "Title qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async (g: CategoryGroup) => {
    if (storeId == null || isAll) return;
    const count = categories.filter((c) => c.group_id === g.id).length;
    const ok = await confirm({
      title: `"${g.name_uz}" title o'chirilsinmi?`,
      message: count ? `Bu title ostida ${count} ta kategoriya bor — ular sarlavhasiz qoladi.` : undefined,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/category-groups/${g.id}`, storeId));
      await loadData(storeId);
      toast.success("Title o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const saveCat = async () => {
    if (!editCat || storeId == null || isAll || !editCat.name_uz?.trim() || saving) return;
    setSaving(true);
    try {
      const body = {
        parent_id: null,
        group_id: editCat.group_id ?? null,
        name_uz: editCat.name_uz,
        name_ru: editCat.name_ru || editCat.name_uz,
        image_url: editCat.image_url ?? null,
        bg_color: editCat.bg_color ?? null,
        is_active: editCat.is_active ?? true,
        sort_order: editCat.sort_order ?? topCategories.length,
      };
      if (editCat.id) await put(withStore(`/admin/categories/${editCat.id}`, storeId), body);
      else await post(withStore("/admin/categories", storeId), body);
      const isEdit = !!editCat.id;
      setEditCat(null);
      await loadData(storeId);
      toast.success(isEdit ? "Kategoriya yangilandi" : "Kategoriya qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const toggleCatActive = async (c: Category) => {
    if (storeId == null || isAll || saving) return;
    const next = !(c.is_active ?? true);
    setSaving(true);
    try {
      await put(withStore(`/admin/categories/${c.id}`, storeId), {
        parent_id: c.parent_id ?? null,
        group_id: c.group_id ?? null,
        name_uz: c.name_uz,
        name_ru: c.name_ru,
        image_url: c.image_url ?? null,
        bg_color: c.bg_color ?? null,
        is_active: next,
        sort_order: c.sort_order,
      });
      setCategories((list) => list.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)));
      toast.success(next ? "Faollashtirildi" : "Nofaollashtirildi");
    } catch {
      toast.error("O'zgartirib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const saveSubcat = async () => {
    if (!editSubcat || storeId == null || isAll || !editSubcat.name_uz?.trim() || !editSubcat.parent_id || saving) return;
    setSaving(true);
    try {
      const body = {
        parent_id: editSubcat.parent_id,
        name_uz: editSubcat.name_uz,
        name_ru: editSubcat.name_ru || editSubcat.name_uz,
        image_url: null,
        is_active: editSubcat.is_active ?? true,
        sort_order: editSubcat.sort_order ?? subcategories.length,
      };
      if (editSubcat.id) await put(withStore(`/admin/categories/${editSubcat.id}`, storeId), body);
      else await post(withStore("/admin/categories", storeId), body);
      const isEdit = !!editSubcat.id;
      setEditSubcat(null);
      await loadData(storeId);
      toast.success(isEdit ? "Subkategoriya yangilandi" : "Subkategoriya qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const saveQuickSub = async () => {
    if (!quickSub || storeId == null || isAll || !quickSub.name_uz?.trim() || !quickSub.parent_id || saving) return;
    setSaving(true);
    try {
      const body = {
        parent_id: quickSub.parent_id,
        name_uz: quickSub.name_uz,
        name_ru: quickSub.name_ru || quickSub.name_uz,
        image_url: null,
        sort_order: subcategories.length,
      };
      const created = await post<Category>(withStore("/admin/categories", storeId), body);
      setQuickSub(null);
      await loadData(storeId);
      setEditing((cur) => (cur ? { ...cur, category_id: created.id } : cur));
      toast.success("Subkategoriya qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const removeCat = async (c: Category) => {
    if (storeId == null || isAll) return;
    const count = products.filter((p) => p.category_id === c.id).length;
    const ok = await confirm({
      title: `"${c.name_uz}" kategoriyasi o'chirilsinmi?`,
      message: count
        ? `Bu kategoriyada ${count} ta mahsulot bor.`
        : undefined,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/categories/${c.id}`, storeId));
      await loadData(storeId);
      toast.success("Kategoriya o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const topCategories = categories.filter((c) => c.parent_id == null);
  const subcategories = categories.filter((c) => c.parent_id != null);
  // Mahsulot modalidagi "Kategoriya" tanlovi alohida saqlanmaydi — tanlangan
  // subkategoriyaning ota-kategoriyasidan chiqarib olinadi (yagona haqiqat manbai).
  const selectedTopId = topOverride
    ?? categories.find((c) => c.id === editing?.category_id)?.parent_id
    ?? topCategories[0]?.id;
  const childrenOfSelectedTop = categories.filter((c) => c.parent_id === selectedTopId);
  const catPath = (id: number) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return "—";
    const parent = categories.find((x) => x.id === c.parent_id);
    return parent ? `${parent.name_uz} > ${c.name_uz}` : c.name_uz;
  };
  const margin = (p: Product) => (p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0);

  const filteredProducts = products.filter((p) => {
    if (filterCat !== "all" && categories.find((c) => c.id === p.category_id)?.parent_id !== filterCat) return false;
    const q = search.trim().toLowerCase();
    if (q && !p.name_uz.toLowerCase().includes(q) && !p.name_ru.toLowerCase().includes(q)) return false;
    return true;
  });

  if (storeId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Mahsulotlar</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">
          <Store size={32} className="mx-auto mb-3 opacity-30" />
          Avval "Do'konlar" bo'limida do'kon yarating, so'ng yuqoridagi ro'yxatdan tanlang
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-14 z-20 -mt-4 md:-mt-8 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 md:pt-8 pb-3 bg-[#f8fafc] md:bg-[#f8fafc]/95 md:backdrop-blur-md border-b border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Mahsulotlar</h1>
            <p className="text-slate-500">Mahsulotlar va kategoriyalarni boshqarish.</p>
          </div>
          
          {stores.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-sm">
              <span className="text-sm text-slate-500 font-medium px-3 hidden sm:inline-block">Qaysi do'kon:</span>
              <select
                className="input py-1.5 text-sm font-semibold text-brand border-none bg-white shadow-sm w-[200px]"
                value={storeId ?? ""}
                onChange={(e) => setSelectedStore(e.target.value === "all" ? "all" : Number(e.target.value))}
              >
                <option value="all">Barcha do'konlar</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            className={`whitespace-nowrap inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${tab === "products" ? "bg-brand text-white shadow-md shadow-brand/25" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            onClick={() => setTab("products")}
          ><ShoppingBasket size={16} /> Mahsulotlar</button>
          <button
            className={`whitespace-nowrap inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${tab === "subcategories" ? "bg-brand text-white shadow-md shadow-brand/25" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            onClick={() => setTab("subcategories")}
          ><Tags size={16} /> Subkategoriyalar</button>
          <button
            className={`whitespace-nowrap inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${tab === "categories" ? "bg-brand text-white shadow-md shadow-brand/25" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            onClick={() => setTab("categories")}
          ><FolderTree size={16} /> Kategoriyalar</button>
          <button
            className={`whitespace-nowrap inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 ${tab === "groups" ? "bg-brand text-white shadow-md shadow-brand/25" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            onClick={() => setTab("groups")}
          ><Heading size={16} /> Title</button>
        </div>
      </div>

      {/* ── PRODUCTS ─────────────────────────────────────── */}
      {tab === "products" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input w-full sm:w-56 pl-9"
                  placeholder="Mahsulot qidirish..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="input w-full sm:w-48"
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value === "all" ? "all" : +e.target.value)}
              >
                <option value="all">Barcha kategoriyalar</option>
                {topCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_uz}</option>
                ))}
              </select>
            </div>
            <button
              className="btn justify-center"
              disabled={isAll || topCategories.length === 0}
              title={isAll ? "Aniq do'kon tanlang" : topCategories.length === 0 ? "Avval kategoriya qo'shing" : ""}
              onClick={() => {
                setTopOverride(undefined);
                setEditing({ category_id: subcategories[0]?.id, is_available: true, price: 0, cost: 0, stock: 0, unit: "kg", low_stock_threshold: 10 });
              }}
            >
              <Plus size={18} /> Mahsulot qo'shish
            </button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={6} /> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Mahsulot</th>
                  {isAll && <th className="th">Do'kon</th>}
                  <th className="th">Kategoriya</th>
                  <th className="th">Narx</th>
                  <th className="th">Tannarx</th>
                  <th className="th">Qoldiq</th>
                  <th className="th">Mavjud</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
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
                    <td className="td">{catPath(p.category_id)}</td>
                    <td className="td">{money(p.price)} so'm</td>
                    <td className="td">
                      {money(p.cost)} <span className="text-xs text-slate-400">({margin(p)}%)</span>
                    </td>
                    <td className="td">
                      <span className={p.stock <= p.low_stock_threshold ? "text-rose-600 font-semibold" : ""}>
                        {p.stock} <span className="text-xs text-slate-400">{p.unit}</span>
                      </span>
                    </td>
                    <td className="td">
                      {p.is_available
                        ? <CircleCheck size={18} className="text-emerald-600" />
                        : <CircleX size={18} className="text-slate-300" />}
                    </td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button className="icon-btn" title={isAll ? "Aniq do'kon tanlang" : "Tahrirlash"} disabled={isAll} onClick={() => { setTopOverride(undefined); setEditing(p); }}><Pencil size={16} /></button>
                        <button className="icon-btn hover:text-red-600" title={isAll ? "Aniq do'kon tanlang" : "O'chirish"} disabled={isAll} onClick={() => removeProduct(p)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={isAll ? 8 : 7} className="td text-center text-slate-400 py-10">
                    {products.length === 0
                      ? (subcategories.length === 0 ? "Avval subkategoriya qo'shing" : "Mahsulot yo'q")
                      : "Filterga mos mahsulot topilmadi"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* ── SUBCATEGORIES ────────────────────────────────── */}
      {tab === "subcategories" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              className="btn"
              disabled={isAll || topCategories.length === 0}
              title={isAll ? "Aniq do'kon tanlang" : topCategories.length === 0 ? "Avval kategoriya qo'shing" : ""}
              onClick={() => setEditSubcat({ parent_id: topCategories[0]?.id })}
            >
              <Plus size={18} /> Subkategoriya qo'shish
            </button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={4} /> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Kategoriya</th>
                  <th className="th">Nomi (uz)</th>
                  <th className="th">Название (ru)</th>
                  <th className="th">Mahsulotlar</th>
                  <th className="th">Holat</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {subcategories.map((c) => {
                  const active = c.is_active ?? true;
                  return (
                  <tr key={c.id} className={`hover:bg-slate-50/60 ${active ? "" : "opacity-60"}`}>
                    <td className="td text-slate-500">{categories.find((x) => x.id === c.parent_id)?.name_uz ?? "—"}</td>
                    <td className="td font-medium text-slate-900">{c.name_uz}</td>
                    <td className="td">{c.name_ru}</td>
                    <td className="td">{products.filter((p) => p.category_id === c.id).length}</td>
                    <td className="td">
                      <button
                        type="button"
                        disabled={isAll || saving}
                        onClick={() => void toggleCatActive(c)}
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                          active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                        title={isAll ? "Aniq do'kon tanlang" : active ? "Nofaollashtirish" : "Faollashtirish"}
                      >
                        <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${active ? "bg-brand" : "bg-slate-300"}`}>
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`} />
                        </span>
                        {active ? "Faol" : "Nofaol"}
                      </button>
                    </td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button className="icon-btn" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : "Tahrirlash"} onClick={() => setEditSubcat(c)}><Pencil size={16} /></button>
                        <button className="icon-btn hover:text-red-600" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : "O'chirish"} onClick={() => removeCat(c)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {subcategories.length === 0 && (
                  <tr><td colSpan={6} className="td text-center text-slate-400 py-10">
                    {topCategories.length === 0 ? "Avval kategoriya qo'shing" : "Subkategoriya yo'q"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* ── TITLE (category_groups) ──────────────────────── */}
      {tab === "groups" && (
        <>
          <div className="flex justify-end mb-4">
            <button className="btn" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : ""} onClick={() => setEditGroup({ bg_color: DEFAULT_CATEGORY_COLOR })}><Plus size={18} /> Title qo'shish</button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={3} /> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Nomi (uz)</th>
                  <th className="th">Название (ru)</th>
                  <th className="th">Rang</th>
                  <th className="th">Kategoriyalar</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/60">
                    <td className="td font-medium text-slate-900">{g.name_uz}</td>
                    <td className="td">{g.name_ru}</td>
                    <td className="td">
                      <span
                        className="inline-block h-7 w-10 rounded-lg border border-slate-200"
                        style={{ backgroundColor: g.bg_color || DEFAULT_CATEGORY_COLOR }}
                        title={g.bg_color || DEFAULT_CATEGORY_COLOR}
                      />
                    </td>
                    <td className="td">{categories.filter((c) => c.group_id === g.id).length}</td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button className="icon-btn" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : "Tahrirlash"} onClick={() => setEditGroup(g)}><Pencil size={16} /></button>
                        <button className="icon-btn hover:text-red-600" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : "O'chirish"} onClick={() => removeGroup(g)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-slate-400 py-10">
                    Title yo'q — bosh sahifada kategoriyalarni sarlavha ostida guruhlash uchun qo'shing
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* ── CATEGORIES ───────────────────────────────────── */}
      {tab === "categories" && (
        <>
          <div className="flex justify-end mb-4">
            <button className="btn" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : ""} onClick={() => setEditCat({})}><Plus size={18} /> Kategoriya qo'shish</button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={3} /> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Nomi (uz)</th>
                  <th className="th">Название (ru)</th>
                  <th className="th">Title</th>
                  <th className="th">Subkategoriyalar</th>
                  <th className="th">Holat</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {topCategories.map((top) => {
                  const active = top.is_active ?? true;
                  const grp = groups.find((g) => g.id === top.group_id);
                  return (
                  <tr key={top.id} className={`hover:bg-slate-50/60 ${active ? "" : "opacity-60"}`}>
                    <td className="td font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        {top.image_url
                          ? <img src={top.image_url} alt="" className="h-9 w-12 rounded-lg object-cover bg-slate-100" />
                          : <span className="h-9 w-12 rounded-lg bg-slate-100" style={grp?.bg_color ? { backgroundColor: grp.bg_color } : undefined} />}
                        {top.name_uz}
                      </div>
                    </td>
                    <td className="td">{top.name_ru}</td>
                    <td className="td text-slate-500">{grp?.name_uz ?? "—"}</td>
                    <td className="td">{categories.filter((c) => c.parent_id === top.id).length}</td>
                    <td className="td">
                      <button
                        type="button"
                        disabled={isAll || saving}
                        onClick={() => void toggleCatActive(top)}
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                          active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                        title={isAll ? "Aniq do'kon tanlang" : active ? "Nofaollashtirish" : "Faollashtirish"}
                      >
                        <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${active ? "bg-brand" : "bg-slate-300"}`}>
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`} />
                        </span>
                        {active ? "Faol" : "Nofaol"}
                      </button>
                    </td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button className="icon-btn" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : "Tahrirlash"} onClick={() => setEditCat(top)}><Pencil size={16} /></button>
                        <button className="icon-btn hover:text-red-600" disabled={isAll} title={isAll ? "Aniq do'kon tanlang" : "O'chirish"} onClick={() => removeCat(top)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {topCategories.length === 0 && (
                  <tr><td colSpan={6} className="td text-center text-slate-400 py-10">Kategoriya yo'q — "Qo'shish" bilan qo'shing</td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* ── PRODUCT MODAL ────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100 shrink-0">
              <h2 className="font-bold text-xl">{editing.id ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{editing.id ? `#${editing.id}` : "Barcha maydonlarni to'ldiring"}</p>
            </div>

            <div className="px-7 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Kategoriya → Subkategoriya (bosqichma-bosqich) */}
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya</label>
                    <select
                      className="input w-full"
                      disabled={topCategories.length === 0}
                      value={selectedTopId ?? ""}
                      onChange={(e) => {
                        const topId = +e.target.value;
                        const firstChild = categories.find((c) => c.parent_id === topId);
                        setTopOverride(topId);
                        setEditing({ ...editing, category_id: firstChild?.id });
                      }}
                    >
                      {topCategories.length === 0 ? (
                        <option value="">Kategoriya yo'q</option>
                      ) : (
                        topCategories.map((top) => (
                          <option key={top.id} value={top.id}>{top.name_uz}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Subkategoriya</label>
                    <div className="flex gap-2">
                      <select
                        className="input flex-1"
                        disabled={childrenOfSelectedTop.length === 0}
                        value={editing.category_id ?? ""}
                        onChange={(e) => setEditing({ ...editing, category_id: +e.target.value })}
                      >
                        {childrenOfSelectedTop.length === 0 ? (
                          <option value="">Subkategoriya yo'q</option>
                        ) : (
                          childrenOfSelectedTop.map((c) => (
                            <option key={c.id} value={c.id}>{c.name_uz}</option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        className="icon-btn shrink-0"
                        title="Yangi subkategoriya"
                        disabled={topCategories.length === 0}
                        onClick={() => setQuickSub((cur) => (cur ? null : { parent_id: selectedTopId ?? topCategories[0]?.id }))}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {quickSub && (
                  <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                    <select className="input" value={quickSub.parent_id ?? ""}
                      onChange={(e) => setQuickSub({ ...quickSub, parent_id: +e.target.value })}>
                      <option value="" disabled>Kategoriyani tanlang</option>
                      {topCategories.map((top) => (
                        <option key={top.id} value={top.id}>{top.name_uz}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" placeholder="Nomi (uz)" value={quickSub.name_uz ?? ""}
                        onChange={(e) => setQuickSub({ ...quickSub, name_uz: e.target.value })} />
                      <input className="input" placeholder="Название (ru)" value={quickSub.name_ru ?? ""}
                        onChange={(e) => setQuickSub({ ...quickSub, name_ru: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button className="btn-ghost text-xs" onClick={() => setQuickSub(null)} disabled={saving}>Bekor</button>
                      <button className="btn text-xs" onClick={saveQuickSub} disabled={saving || !quickSub.parent_id || !quickSub.name_uz?.trim()}>
                        Qo'shish
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Nomlar */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi (uz)</label>
                  <input className="input" placeholder="Masalan: Olma" value={editing.name_uz ?? ""}
                    onChange={(e) => setEditing({ ...editing, name_uz: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Название (ru)</label>
                  <input className="input" placeholder="Например: Яблоко" value={editing.name_ru ?? ""}
                    onChange={(e) => setEditing({ ...editing, name_ru: e.target.value })} />
                </div>
              </div>

              {/* Tasvir */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mahsulot rasmi</label>
                <ImageUpload
                  label=""
                  value={editing.image_url}
                  heightClass="h-36"
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                />
              </div>

              {/* Narx, Tannarx, O'lchov birligi */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Narx va o'lchov</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Sotuv narxi (so'm)</label>
                    <input className="input" type="text" inputMode="decimal" placeholder="0"
                      value={numInput(editing.price)}
                      onChange={(e) => setEditing({ ...editing, price: parseNum(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tannarx (so'm)</label>
                    <input className="input" type="text" inputMode="decimal" placeholder="0"
                      value={numInput(editing.cost)}
                      onChange={(e) => setEditing({ ...editing, cost: parseNum(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">O'lchov birligi</label>
                    <select className="input" value={editing.unit ?? "kg"}
                      onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                      {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                </div>
                {(editing.price ?? 0) > 0 && (editing.cost ?? 0) > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Margin: {Math.round(((editing.price! - editing.cost!) / editing.price!) * 100)}% · Foyda: {money(editing.price! - editing.cost!)} so'm / {editing.unit ?? "kg"}
                  </p>
                )}
              </div>

              {/* Ombor */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Ombor</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Qoldiq ({editing.unit ?? "kg"})</label>
                    <input className="input" type="text" inputMode="decimal" placeholder="0"
                      value={numInput(editing.stock)}
                      onChange={(e) => setEditing({ ...editing, stock: parseNum(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Kam qoldiq chegarasi ({editing.unit ?? "kg"})</label>
                    <input className="input" type="text" inputMode="decimal" placeholder="10"
                      value={numInput(editing.low_stock_threshold)}
                      onChange={(e) => setEditing({ ...editing, low_stock_threshold: parseNum(e.target.value) })} />
                  </div>
                </div>
              </div>

              {/* Tavsif */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif (uz)</label>
                  <textarea className="input resize-none h-20" placeholder="Ixtiyoriy..."
                    value={editing.description_uz ?? ""}
                    onChange={(e) => setEditing({ ...editing, description_uz: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Описание (ru)</label>
                  <textarea className="input resize-none h-20" placeholder="Необязательно..."
                    value={editing.description_ru ?? ""}
                    onChange={(e) => setEditing({ ...editing, description_ru: e.target.value })} />
                </div>
              </div>

              {/* Mavjudlik */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={editing.is_available ?? true}
                    onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })} />
                  <div className="w-10 h-6 bg-slate-200 peer-checked:bg-brand rounded-full transition-colors" />
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-sm font-medium text-slate-700">Sotuvda mavjud</span>
              </label>
            </div>

            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl shrink-0">
              <button className="btn-ghost" onClick={() => setEditing(null)} disabled={saving}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={saveProduct} disabled={saving || !editing.category_id}>
                <CircleCheck size={16} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORY MODAL ───────────────────────────────── */}
      {editCat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-xl">{editCat.id ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}</h2>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi (uz)</label>
                  <input className="input" placeholder="Masalan: Mevalar" value={editCat.name_uz ?? ""}
                    onChange={(e) => setEditCat({ ...editCat, name_uz: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Название (ru)</label>
                  <input className="input" placeholder="Например: Фрукты" value={editCat.name_ru ?? ""}
                    onChange={(e) => setEditCat({ ...editCat, name_ru: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title (ixtiyoriy)</label>
                <select
                  className="input"
                  value={editCat.group_id ?? ""}
                  onChange={(e) => setEditCat({ ...editCat, group_id: e.target.value ? +e.target.value : null })}
                >
                  <option value="">Yo'q</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name_uz}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Bosh sahifada bu kategoriya shu sarlavha ostida ko'rsatiladi. Rang Title dan olinadi.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya rasmi</label>
                <ImageUpload
                  label=""
                  value={editCat.image_url}
                  heightClass="h-32"
                  onChange={(url) => setEditCat({ ...editCat, image_url: url })}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={editCat.is_active ?? true}
                    onChange={(e) => setEditCat({ ...editCat, is_active: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-checked:bg-brand rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-800">
                    {(editCat.is_active ?? true) ? "Faol" : "Nofaol"}
                  </span>
                  <p className="text-xs text-slate-400">
                    Nofaol kategoriya mijoz ilovasida ko&apos;rinmaydi
                  </p>
                </div>
              </label>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl">
              <button className="btn-ghost" onClick={() => setEditCat(null)} disabled={saving}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={saveCat} disabled={saving || !editCat.name_uz?.trim()}>
                <CircleCheck size={16} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBCATEGORY MODAL ────────────────────────────── */}
      {editSubcat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-xl">{editSubcat.id ? "Subkategoriyani tahrirlash" : "Yangi subkategoriya"}</h2>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya</label>
                <select className="input" value={editSubcat.parent_id ?? ""}
                  onChange={(e) => setEditSubcat({ ...editSubcat, parent_id: +e.target.value })}>
                  <option value="" disabled>Kategoriyani tanlang</option>
                  {topCategories.map((top) => (
                    <option key={top.id} value={top.id}>{top.name_uz}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi (uz)</label>
                  <input className="input" placeholder="Masalan: Olma" value={editSubcat.name_uz ?? ""}
                    onChange={(e) => setEditSubcat({ ...editSubcat, name_uz: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Название (ru)</label>
                  <input className="input" placeholder="Например: Яблоко" value={editSubcat.name_ru ?? ""}
                    onChange={(e) => setEditSubcat({ ...editSubcat, name_ru: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={editSubcat.is_active ?? true}
                    onChange={(e) => setEditSubcat({ ...editSubcat, is_active: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-checked:bg-brand rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-800">
                    {(editSubcat.is_active ?? true) ? "Faol" : "Nofaol"}
                  </span>
                  <p className="text-xs text-slate-400">
                    Nofaol subkategoriya mijoz ilovasida ko&apos;rinmaydi
                  </p>
                </div>
              </label>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl">
              <button className="btn-ghost" onClick={() => setEditSubcat(null)} disabled={saving}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={saveSubcat} disabled={saving || !editSubcat.parent_id || !editSubcat.name_uz?.trim()}>
                <CircleCheck size={16} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TITLE MODAL ──────────────────────────────────── */}
      {editGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-xl">{editGroup.id ? "Title'ni tahrirlash" : "Yangi title"}</h2>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi (uz)</label>
                  <input className="input" placeholder="Masalan: Meva va sabzavotlar" value={editGroup.name_uz ?? ""}
                    onChange={(e) => setEditGroup({ ...editGroup, name_uz: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Название (ru)</label>
                  <input className="input" placeholder="Например: Фрукты и овощи" value={editGroup.name_ru ?? ""}
                    onChange={(e) => setEditGroup({ ...editGroup, name_ru: e.target.value })} />
                </div>
              </div>
              <ColorPicker
                value={editGroup.bg_color}
                onChange={(hex) => setEditGroup({ ...editGroup, bg_color: hex })}
              />
              <p className="text-xs text-slate-400 -mt-2">
                Shu title ga bog&apos;langan barcha kategoriyalar bosh sahifada shu rangda chiqadi.
              </p>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl">
              <button className="btn-ghost" onClick={() => setEditGroup(null)} disabled={saving}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={saveGroup} disabled={saving || !editGroup.name_uz?.trim()}>
                <CircleCheck size={16} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
