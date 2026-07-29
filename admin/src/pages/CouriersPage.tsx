import { KeyRound, Plus, PowerOff, Search, Trash2, X } from "lucide-react";
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

  const [form, setForm] = useState<{
    username: string;
    password: string;
    name: string;
    phone: string;
    role: string;
  } | null>(null);
  
  const [pwModal, setPwModal] = useState<CourierAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");

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
      toast.success("Xodim yaratildi");
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

  const toggle = async (u: CourierAccount) => {
    try {
      await patch(`/admin/admin-users/${u.id}/toggle`, {});
      toast.success(u.is_active ? "Xodim bloklandi" : "Xodim aktivlashtirildi");
      load();
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    }
  };

  const remove = async (u: CourierAccount) => {
    const ok = await confirm({
      title: `"${u.username}" xodimni o'chirasizmi?`,
      message: "Bu akkaunt butunlay o'chiriladi.",
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
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(a => 
        a.username.toLowerCase().includes(q) || 
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q))
      );
    }
    return res;
  }, [accounts, search, filterRole]);

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

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Xodimlar</h1>
          <p className="text-slate-500 mb-2">Kuryer va menejerlarni boshqarish</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Qidirish..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-xl border-slate-200 focus:border-brand focus:ring-brand text-sm"
            />
          </div>
          <select 
            className="input w-auto py-2 text-sm" 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Barchasi</option>
            <option value="courier">Kuryerlar</option>
            <option value="manager">Menejerlar</option>
          </select>
          <button
            className="btn py-2 shrink-0"
            onClick={() => { setErr(""); setForm({ username: "", password: "", name: "", phone: "", role: "courier" }); }}
          >
            <Plus size={18} /> Qo'shish
          </button>
        </div>
      </div>

      {loading ? <TableSkeleton cols={7} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Login</th>
                  <th className="th">Ism</th>
                  <th className="th">Telefon</th>
                  <th className="th">Rol</th>
                  <th className="th">Holat</th>
                  <th className="th">Qo'shilgan</th>
                  <th className="th text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="td font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-full bg-brand/10 text-brand text-sm font-bold flex items-center justify-center uppercase">
                          {u.username[0]}
                        </span>
                        <div>
                          <div className="font-semibold">{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td text-slate-600 font-medium">{u.name || "—"}</td>
                    <td className="td text-slate-600">
                      {u.phone ? <a href={`tel:${u.phone}`} className="hover:text-brand transition-colors">{u.phone}</a> : "—"}
                    </td>
                    <td className="td">
                      <span className={`pill ${ROLE_PILL[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="td">
                      {u.is_active
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 uppercase">Faol</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-500 uppercase">Bloklangan</span>}
                    </td>
                    <td className="td text-slate-400 text-sm font-medium">
                      {new Date(u.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          className="icon-btn hover:text-blue-600 hover:bg-blue-50"
                          title="Parolni o'zgartirish"
                          onClick={() => setPwModal(u)}
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          className={`icon-btn ${u.is_active ? "hover:text-amber-600 hover:bg-amber-50" : "hover:text-emerald-600 hover:bg-emerald-50"}`}
                          title={u.is_active ? "Bloklash" : "Aktivlashtirish"}
                          onClick={() => toggle(u)}
                        >
                          <PowerOff size={16} className={u.is_active ? "text-amber-500" : "text-emerald-500"} />
                        </button>
                        <button
                          className="icon-btn hover:text-red-600 hover:bg-red-50"
                          title="O'chirish"
                          onClick={() => remove(u)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="td py-16 text-center">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-50 mb-4">
                        <Search size={28} className="text-slate-400" />
                      </div>
                      <div className="text-slate-500 font-medium">Hech qanday xodim topilmadi</div>
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
