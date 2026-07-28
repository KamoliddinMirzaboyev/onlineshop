import { KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import InstallButton from "../components/InstallButton";
import PageHeader from "../components/PageHeader";
import PushButton from "../components/PushButton";
import { useAuth } from "../store";

export default function ProfilePage() {
  const nav = useNavigate();
  const { username, role, logout, changePassword } = useAuth();

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 6) {
      setMsg({ ok: false, text: "Yangi parol kamida 6 ta belgi bo'lsin" });
      return;
    }
    if (newPw !== confirmPw) {
      setMsg({ ok: false, text: "Parollar mos kelmadi" });
      return;
    }
    setSaving(true);
    try {
      await changePassword(oldPw, newPw);
      setMsg({ ok: true, text: "Parol o'zgartirildi ✓" });
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const raw = String(err);
      if (raw.includes("Eski parol")) setMsg({ ok: false, text: "Eski parol noto'g'ri" });
      else if (raw.includes("farq qilishi")) setMsg({ ok: false, text: "Yangi parol eskisidan farq qilsin" });
      else setMsg({ ok: false, text: "Parolni o'zgartirib bo'lmadi" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

  return (
    <>
      <PageHeader title="Profil" />

      <div className="p-4 space-y-4">
        {/* Profil kartasi */}
        <div className="card p-4 flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-brand/10 flex items-center justify-center">
            <User size={26} className="text-brand" />
          </div>
          <div>
            <div className="text-lg font-bold">{username ?? "—"}</div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <ShieldCheck size={13} /> {role === "courier" ? "Kuryer" : role ?? "—"}
            </div>
          </div>
        </div>

        {/* Ilovani o'rnatish */}
        <div className="card px-4">
          <InstallButton />
        </div>

        {/* Bildirishnoma */}
        <div className="card px-4">
          <PushButton />
        </div>

        {/* Parol o'zgartirish */}
        <form onSubmit={submit} className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <KeyRound size={16} /> Parolni o'zgartirish
          </div>
          <PasswordInput
            className={inputCls}
            placeholder="Eski parol"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            required
          />
          <PasswordInput
            className={inputCls}
            placeholder="Yangi parol"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
          />
          <PasswordInput
            className={inputCls}
            placeholder="Yangi parolni takrorlang"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
          />
          {msg && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                msg.ok ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"
              }`}
            >
              {msg.text}
            </div>
          )}
          <button type="submit" className="btn w-full justify-center" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </form>

        {/* Chiqish */}
        <button
          onClick={() => {
            logout();
            nav("/login");
          }}
          className="w-full py-3 rounded-2xl border border-red-200 text-red-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <LogOut size={16} /> Chiqish
        </button>

        <p className="text-center text-xs text-slate-300">Barakali Bozor Kuryer · v1.1.0</p>
      </div>
    </>
  );
}
