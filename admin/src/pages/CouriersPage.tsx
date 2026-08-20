import { 
  KeyRound, Plus, Lock, Unlock, Search, Trash2, X, Ban
} from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { del, get, patch, post } from "../api";
import { confirm } from "../components/Confirm";
import { TableSkeleton } from "../components/Skeleton";
import type { AdminUser } from "../types";

interface CourierAccount extends AdminUser {
  created_at: string;
}

export default function CouriersPage() {
  const [accounts, setAccounts] = useState<CourierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "blocked">("all");

  const [form, setForm] = useState<{
    username: string;
    password: string;
    name: string;
    phone: string;
    role: string;
  } | null>(null);
  
  const [pwModal, setPwModal] = useState<CourierAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setAccounts(await get<CourierAccount[]>("/admin/admin-users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form || !form.username.trim() || !form.password.trim()) return;
    setErr("");
    try {
      await post("/admin/admin-users", {
        ...form,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      setForm(null);
      toast.success("Xodim muvaffaqiyatli yaratildi");
      load();
    } catch (e) {
      setErr(String(e));
    }
  };

  const changePw = async () => {
    if (!pwModal || newPassword.length < 6) return;
    try {
      await patch(`/admin/admin-users/${pwModal.id}/password`, { password: newPassword });
      setPwModal(null);
      setNewPassword("");
      toast.success("Parol muvaffaqiyatli o'zgartirildi");
    } catch {
      toast.error("Parolni o'zgartirib bo'lmadi");
    }
  };

  const toggleStatus = async (u: CourierAccount) => {
    const isBlocking = u.is_active;
    const name = u.name || u.username;

    const ok = await confirm({
      title: isBlocking 
        ? `"${name}" xodimini bloklaysizmi?` 
        : `"${name}" xodimini faollashtirasizmi?`,
      message: isBlocking
        ? "Bloklangan xodim ilova yoki admin panelga kira olmaydi, yangi buyurtmalarni ko'ra olmaydi."
        : "Xodim yana tizimga kirish va buyurtmalar ustida ishlash imkoniyatiga ega bo'ladi.",
      confirmText: isBlocking ? "Ha, bloklash" : "Faollashtirish",
      danger: isBlocking,
    });

    if (!ok) return;

    setTogglingId(u.id);
    try {
      await patch(`/admin/admin-users/${u.id}/toggle`, {});
      toast.success(
        isBlocking 
          ? `"${name}" xodimi muvaffaqiyatli bloklandi` 
          : `"${name}" xodimi faollashtirildi`
      );
      load();
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async (u: CourierAccount) => {
    const ok = await confirm({
      title: `"${u.name || u.username}" xodimni butunlay o'chirasizmi?`,
      message: "Bu akkaunt tizimdan to'liq o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/admin/admin-users/${u.id}`);
      toast.success("Xodim o'chirildi");
      load();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const filtered = useMemo(() => {
    let res = accounts;
    if (filterRole !== "all") {
      res = res.filter(a => a.role === filterRole);
    }
    if (filterStatus === "active") {
      res = res.filter(a => a.is_active);
    } else if (filterStatus === "blocked") {
      res = res.filter(a => !a.is_active);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(a => 
        a.username.toLowerCase().includes(q) || 
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q))
      );
    }
    return res;
  }, [accounts, search, filterRole, filterStatus]);

  const ROLE_LABEL: Record<string, string> = {
    superadmin: "Superadmin",
    manager: "Menejer",
    courier: "Kuryer",
  };
  const ROLE_PILL: Record<string, string> = {
    superadmin: "bg-rose-100 text-rose-700",
    manager: "bg-sky-100 text-sky-700",
    courier: "bg-violet-100 text-violet-700",
  };

  const activeCount = useMemo(() => accounts.filter(a => a.is_active).length, [accounts]);
  const blockedCount = useMemo(() => accounts.filter(a => !a.is_active).length, [accounts]);

  return (
    <div className="space-y-6">
      {/* ── HEADER VA STATISTIKA ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Xodimlar</h1>
          <p className="text-sm text-slate-500">
            Jami: <b className="text-slate-700">{accounts.length} ta</b> • 
            Faol: <span className="font-semibold text-emerald-600">{activeCount} ta</span> • 
            Bloklangan: <span className="font-semibold text-rose-600">{blockedCount} ta</span>
          </p>
        </div>

        <button
          className="btn py-2 px-4 shadow-sm"
          onClick={() => { setErr(""); setForm({ username: "", password: "", name: "", phone: "", role: "courier" }); }}
        >
          <Plus size={18} /> Yangi xodim qo'shish
        </button>
      </div>

      {/* ── FILTERLAR VA QIDIRUV ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Ism, login yoki telefon orqali qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-xl border border-slate-200 focus:border-brand focus:ring-brand text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Holat filtri */}
          <div className="inline-flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-medium">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-lg transition ${filterStatus === "all" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
            >
              Barchasi ({accounts.length})
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filterStatus === "active" ? "bg-white text-emerald-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Faollar ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus("blocked")}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filterStatus === "blocked" ? "bg-white text-rose-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Bloklanganlar ({blockedCount})
            </button>
          </div>

          {/* Rol filtri */}
          <select 
            className="input w-auto py-2 text-sm bg-white border-slate-200 rounded-xl" 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Barcha rollar</option>
            <option value="courier">Faqat kuryerlar</option>
            <option value="manager">Faqat menejerlar</option>
          </select>
        </div>
      </div>

      {loading ? <TableSkeleton cols={7} /> : (
        <div className="card overflow-hidden bg-white border border-slate-200/80 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3.5 px-4">Xodim</th>
                  <th className="py-3.5 px-4">Telefon</th>
                  <th className="py-3.5 px-4">Rol</th>
                  <th className="py-3.5 px-4">Holat / Kirish</th>
                  <th className="py-3.5 px-4">Qo'shilgan</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((u) => {
                  const isBlocked = !u.is_active;
                  const isBusy = togglingId === u.id;

                  return (
                    <tr 
                      key={u.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isBlocked ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl font-bold flex items-center justify-center uppercase shrink-0 ${
                            isBlocked ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {u.username[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{u.name || u.username}</div>
                            <div className="text-xs text-slate-400 font-mono">@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {u.phone ? (
                          <a href={`tel:${u.phone}`} className="hover:text-brand transition font-medium">
                            {u.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_PILL[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>

                      {/* ── HOLAT USTUNI (Tushunarli va aniq ko'rinish) ── */}
                      <td className="py-3.5 px-4">
                        {u.is_active ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Faol (Kirish ochiq)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                            <Ban size={12} className="text-rose-500" />
                            <span>Bloklangan (Kirish taqiqlangan)</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString("ru-RU")}
                      </td>

                      {/* ── AMALLAR USTUNI ── */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {/* Bloklash / Faollashtirish tugmasi */}
                          <button
                            disabled={isBusy}
                            onClick={() => toggleStatus(u)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm border ${
                              u.is_active
                                ? "bg-white border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                                : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                            } disabled:opacity-50`}
                            title={u.is_active ? "Xodimni bloklash" : "Xodimni faollashtirish"}
                          >
                            {u.is_active ? (
                              <>
                                <Lock size={13} />
                                <span>Bloklash</span>
                              </>
                            ) : (
                              <>
                                <Unlock size={13} />
                                <span>Faollashtirish</span>
                              </>
                            )}
                          </button>

                          {/* Parol o'zgartirish */}
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition border border-transparent hover:border-blue-100"
                            title="Parolni yangilash"
                            onClick={() => setPwModal(u)}
                          >
                            <KeyRound size={16} />
                          </button>

                          {/* O'chirish */}
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-100"
                            title="Xodimni o'chirish"
                            onClick={() => remove(u)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-50 mb-4">
                        <Search size={28} className="text-slate-400" />
                      </div>
                      <div className="text-slate-500 font-medium">Hech qanday xodim topilmadi</div>
                      <p className="text-xs text-slate-400 mt-1">Qidiruv yoki filter shartlarini o'zgartirib ko'ring</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CREATE MODAL ──────────────────────────────── */}
      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="card p-6 w-96 max-w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800">Yangi xodim</h2>
              <button onClick={() => setForm(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Ism</span>
              <input
                className="input mt-1.5"
                placeholder="Aziz Karimov"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Telefon</span>
              <input
                className="input mt-1.5"
                placeholder="+998901234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Login (faqat lotincha, probelsiz)</span>
              <input
                className="input mt-1.5 font-mono"
                placeholder="aziz"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Parol</span>
              <PasswordInput
                className="input mt-1.5"
                placeholder="Kamida 6 ta belgi"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Rol</span>
              <select
                className="input mt-1.5"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="courier">Kuryer (faqat ilova)</option>
                <option value="manager">Menejer (faqat admin panel)</option>
              </select>
            </label>

            {err && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium">{err}</div>}

            <div className="flex gap-3 pt-2">
              <button className="flex-1 btn-secondary" onClick={() => setForm(null)}>Bekor qilish</button>
              <button
                className="flex-1 btn"
                disabled={!form.username || form.password.length < 6}
                onClick={save}
              >
                Yaratish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASSWORD CHANGE MODAL ──────────────────────────────── */}
      {pwModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="card p-6 w-96 max-w-full shadow-xl">
             <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">Parolni o'zgartirish</h2>
              <button onClick={() => setPwModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              <strong className="text-slate-800">{pwModal.username}</strong> uchun yangi parol kiriting:
            </p>
            <PasswordInput
              className="input mt-1.5"
              placeholder="Yangi parol (kamida 6 ta)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="flex gap-3 mt-6">
              <button className="flex-1 btn-secondary" onClick={() => setPwModal(null)}>Bekor qilish</button>
              <button
                className="flex-1 btn"
                disabled={newPassword.length < 6}
                onClick={changePw}
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
