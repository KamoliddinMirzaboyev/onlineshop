import {
  CircleCheck,
  CircleX,
  KeyRound,
  Pencil,
  Plus,
  PowerOff,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, getAll, patch, post, withStore } from "../api";
import { confirm } from "../components/Confirm";
import PasswordInput from "../components/PasswordInput";
import { TableSkeleton } from "../components/Skeleton";
import { useStore } from "../store";
import type { StaffUser } from "../types";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Do'kon egasi",
  manager: "Menejer",
  courier: "Kuryer",
};
const ROLE_PILL: Record<string, string> = {
  superadmin: "bg-rose-100 text-rose-700",
  manager: "bg-sky-100 text-sky-700",
  courier: "bg-violet-100 text-violet-700",
};

type StaffRole = "superadmin" | "manager" | "courier";

type CreateForm = {
  mode: "create";
  username: string;
  password: string;
  name: string;
  phone: string;
  role: "manager" | "courier";
  restaurant_id: number;
};

type EditForm = {
  mode: "edit";
  id: number;
  restaurant_id: number;
  username: string;
  name: string;
  phone: string;
  role: StaffRole;
};

type PasswordForm = {
  mode: "password";
  id: number;
  restaurant_id: number;
  username: string;
  password: string;
  password2: string;
};

type ModalForm = CreateForm | EditForm | PasswordForm;

export default function StaffPage() {
  const storeId = useStore((s) => s.selectedStoreId);
  const stores = useStore((s) => s.stores);
  const isAll = storeId === "all";
  const storeName = (rid: number) => stores.find((s) => s.id === rid)?.name ?? "—";
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ModalForm | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (storeId == null) return;
    setLoading(true);
    try {
      setStaff(
        isAll
          ? await getAll<StaffUser>("/admin/admin-users", stores.map((s) => s.id))
          : await get<StaffUser[]>(withStore("/admin/admin-users", storeId)),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId, stores.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setErr("");
    setForm({
      mode: "create",
      username: "",
      password: "",
      name: "",
      phone: "",
      role: "courier",
      restaurant_id: isAll ? stores[0]?.id ?? 0 : (storeId as number),
    });
  };

  const openEdit = (u: StaffUser) => {
    setErr("");
    setForm({
      mode: "edit",
      id: u.id,
      restaurant_id: u.restaurant_id,
      username: u.username,
      name: u.name ?? "",
      phone: u.phone ?? "",
      role: u.role,
    });
  };

  const openPassword = (u: StaffUser) => {
    setErr("");
    setForm({
      mode: "password",
      id: u.id,
      restaurant_id: u.restaurant_id,
      username: u.username,
      password: "",
      password2: "",
    });
  };

  const saveCreate = async (f: CreateForm) => {
    if (!f.username.trim() || !f.password.trim()) return;
    setErr("");
    setSaving(true);
    try {
      await post(withStore("/admin/admin-users", f.restaurant_id), {
        username: f.username.trim(),
        password: f.password,
        name: f.name.trim() || undefined,
        phone: f.phone.trim() || undefined,
        role: f.role,
      });
      setForm(null);
      toast.success("Xodim yaratildi");
      load();
    } catch (e) {
      const msg = String(e);
      if (msg.includes("409") && msg.toLowerCase().includes("telefon")) {
        setErr("Bu telefon raqam band");
        toast.error("Bu telefon raqam band");
      } else if (msg.includes("409")) {
        setErr("Bu login band");
        toast.error("Bu login band");
      } else {
        setErr(msg.replace("Error: ", ""));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (f: EditForm) => {
    if (!f.username.trim()) {
      setErr("Login majburiy");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      await patch(withStore(`/admin/admin-users/${f.id}`, f.restaurant_id), {
        username: f.username.trim(),
        name: f.name.trim() || null,
        phone: f.phone.trim() || null,
        role: f.role,
      });
      setForm(null);
      toast.success("Xodim yangilandi");
      load();
    } catch (e) {
      const msg = String(e);
      if (msg.includes("409") && msg.toLowerCase().includes("telefon")) {
        setErr("Bu telefon raqam band");
        toast.error("Bu telefon raqam band");
      } else if (msg.includes("409")) {
        setErr("Bu login band");
        toast.error("Bu login band");
      } else {
        setErr(msg.replace("Error: ", ""));
      }
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (f: PasswordForm) => {
    const pw = f.password.trim();
    if (pw.length < 4) {
      setErr("Parol kamida 4 belgi bo'lishi kerak");
      return;
    }
    if (pw !== f.password2.trim()) {
      setErr("Parollar mos kelmadi");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      // Eski parol shart emas — tadbirkor reset qiladi.
      await patch(withStore(`/admin/admin-users/${f.id}/password`, f.restaurant_id), {
        password: pw,
      });
      setForm(null);
      toast.success(`"${f.username}" paroli yangilandi`);
      load();
    } catch (e) {
      setErr(String(e).replace("Error: ", ""));
      toast.error("Parolni o'zgartirib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (u: StaffUser) => {
    try {
      await patch(withStore(`/admin/admin-users/${u.id}/toggle`, u.restaurant_id), {});
      toast.success(u.is_active ? "Xodim bloklandi" : "Xodim aktivlashtirildi");
      load();
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    }
  };

  const remove = async (u: StaffUser) => {
    const ok = await confirm({
      title: `"${u.username}" xodimni o'chirasizmi?`,
      message: "Bu akkaunt butunlay o'chiriladi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/admin-users/${u.id}`, u.restaurant_id));
      toast.success("Xodim o'chirildi");
      load();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  if (storeId == null) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Xodimlar</h1>
        <div className="card p-10 text-center text-slate-400 mt-5">
          <Store size={32} className="mx-auto mb-3 opacity-30" />
          Avval &quot;Do&apos;konlar&quot; bo&apos;limida do&apos;kon yarating, so&apos;ng yuqoridagi ro&apos;yxatdan tanlang
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Xodimlar</h1>
      <p className="text-slate-500 mb-5">Do&apos;kon menejer va kuryer akkauntlari.</p>

      <div className="flex justify-end mb-4">
        <button className="btn" type="button" onClick={openCreate}>
          <Plus size={18} /> Yangi xodim
        </button>
      </div>

      {loading ? (
        <TableSkeleton cols={4} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Login</th>
                <th className="th">Ism</th>
                <th className="th">Telefon</th>
                <th className="th">Rol</th>
                {isAll && <th className="th">Do&apos;kon</th>}
                <th className="th">Holat</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="td font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-brand/10 text-brand text-sm font-bold flex items-center justify-center uppercase">
                        {u.username[0]}
                      </span>
                      {u.username}
                    </div>
                  </td>
                  <td className="td text-slate-600">{u.name || "—"}</td>
                  <td className="td text-slate-600">
                    {u.phone ? (
                      <a href={`tel:${u.phone}`} className="hover:text-brand">
                        {u.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="td">
                    <span className={`pill ${ROLE_PILL[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  {isAll && <td className="td text-slate-500">{storeName(u.restaurant_id)}</td>}
                  <td className="td">
                    {u.is_active ? (
                      <span className="pill bg-emerald-100 text-emerald-700">Faol</span>
                    ) : (
                      <span className="pill bg-slate-100 text-slate-500">Bloklangan</span>
                    )}
                  </td>
                  <td className="td text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Tahrirlash"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil size={15} className="text-slate-500" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Parolni o'zgartirish"
                        onClick={() => openPassword(u)}
                      >
                        <KeyRound size={15} className="text-sky-600" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title={u.is_active ? "Bloklash" : "Aktivlashtirish"}
                        onClick={() => toggle(u)}
                      >
                        <PowerOff
                          size={15}
                          className={u.is_active ? "text-amber-500" : "text-emerald-500"}
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-btn hover:text-red-600"
                        title="O'chirish"
                        onClick={() => remove(u)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={isAll ? 7 : 6} className="td text-center text-slate-400 py-10">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    Hali xodim yo&apos;q — &quot;Yangi xodim&quot; tugmasini bosing
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-md space-y-4 shadow-xl">
            {form.mode === "create" && (
              <>
                <h2 className="font-bold text-lg">Yangi xodim</h2>

                {isAll && (
                  <label className="block">
                    <span className="text-xs text-slate-500">Do&apos;kon</span>
                    <select
                      className="input mt-1"
                      value={form.restaurant_id}
                      onChange={(e) =>
                        setForm({ ...form, restaurant_id: Number(e.target.value) })
                      }
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="text-xs text-slate-500">Ism</span>
                  <input
                    className="input mt-1"
                    placeholder="Aziz Karimov"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Telefon</span>
                  <input
                    className="input mt-1"
                    placeholder="+998901234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Login</span>
                  <input
                    className="input mt-1"
                    placeholder="kuryer1"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Parol</span>
                  <PasswordInput
                    className="input mt-1"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Rol</span>
                  <select
                    className="input mt-1"
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value as "manager" | "courier",
                      })
                    }
                  >
                    <option value="courier">Kuryer</option>
                    <option value="manager">Menejer</option>
                  </select>
                </label>

                {err && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
                    <CircleX size={16} /> Bekor
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={saving || !form.username.trim() || !form.password.trim()}
                    onClick={() => void saveCreate(form)}
                  >
                    <CircleCheck size={16} /> {saving ? "Saqlanmoqda…" : "Yaratish"}
                  </button>
                </div>
              </>
            )}

            {form.mode === "edit" && (
              <>
                <h2 className="font-bold text-lg">Xodimni tahrirlash</h2>
                <p className="text-sm text-slate-500 -mt-2">
                  Login, ism, telefon va rolni o&apos;zgartirish.
                </p>

                <label className="block">
                  <span className="text-xs text-slate-500">Ism</span>
                  <input
                    className="input mt-1"
                    placeholder="Aziz Karimov"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Telefon</span>
                  <input
                    className="input mt-1"
                    placeholder="+998901234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Login</span>
                  <input
                    className="input mt-1"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Rol</span>
                  <select
                    className="input mt-1"
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as StaffRole })
                    }
                  >
                    <option value="courier">Kuryer</option>
                    <option value="manager">Menejer</option>
                    <option value="superadmin">Do&apos;kon egasi</option>
                  </select>
                </label>

                {err && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
                    <CircleX size={16} /> Bekor
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={saving || !form.username.trim()}
                    onClick={() => void saveEdit(form)}
                  >
                    <CircleCheck size={16} /> {saving ? "Saqlanmoqda…" : "Saqlash"}
                  </button>
                </div>
              </>
            )}

            {form.mode === "password" && (
              <>
                <div className="flex items-start gap-3">
                  <span className="h-10 w-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <KeyRound size={18} />
                  </span>
                  <div>
                    <h2 className="font-bold text-lg">Parolni o&apos;zgartirish</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-700">{form.username}</span> uchun
                      yangi parol. Eski parol kerak emas.
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-500">Yangi parol</span>
                  <PasswordInput
                    className="input mt-1"
                    placeholder="Kamida 4 belgi"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-slate-500">Parolni tasdiqlang</span>
                  <PasswordInput
                    className="input mt-1"
                    placeholder="Qayta kiriting"
                    autoComplete="new-password"
                    value={form.password2}
                    onChange={(e) => setForm({ ...form, password2: e.target.value })}
                  />
                </label>

                {err && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
                    <CircleX size={16} /> Bekor
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={
                      saving || form.password.trim().length < 4 || !form.password2.trim()
                    }
                    onClick={() => void savePassword(form)}
                  >
                    <KeyRound size={16} />{" "}
                    {saving ? "Saqlanmoqda…" : "Parolni saqlash"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
