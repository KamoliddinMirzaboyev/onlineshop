import { KeyRound, LogOut, Phone, User } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import InstallButton from "../components/InstallButton";
import PageHeader from "../components/PageHeader";
import PushButton from "../components/PushButton";
import { useAuth } from "../store";

const inputCls =
  "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-slate-50";

export default function ProfilePage() {
  const nav = useNavigate();
  const { username, name, phone, role, logout, changePassword, updateProfile, loadMe } = useAuth();

  const [fullName, setFullName] = useState(name ?? "");
  const [phoneVal, setPhoneVal] = useState(phone ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void loadMe().catch(() => {});
  }, [loadMe]);

  useEffect(() => {
    if (name && !fullName) setFullName(name);
    if (phone && !phoneVal) setPhoneVal(phone);
  }, [name, phone, fullName, phoneVal]);

  const displayName = (name?.trim() || username || "Kuryer");
  const initial = displayName.charAt(0).toUpperCase();

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!fullName.trim()) {
      setProfileMsg({ ok: false, text: "Ism-familiyani kiriting" });
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile({ name: fullName.trim(), phone: phoneVal.trim() });
      setProfileMsg({ ok: true, text: "Profil saqlandi ✓" });
    } catch (err) {
      const raw = String(err);
      setProfileMsg({
        ok: false,
        text: raw.includes("band") ? "Bu telefon band" : "Saqlab bo'lmadi",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPw = async (e: React.FormEvent) => {
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

  return (
    <>
      <PageHeader title="Profil" />

      <div className="p-4 space-y-3.5 pb-8">
        {/* Hero */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-brand-light to-brand text-white shadow-lg shadow-brand/25">
          <div className="flex items-center gap-3.5">
            <div className="h-16 w-16 rounded-2xl bg-white text-brand grid place-items-center text-2xl font-extrabold shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold truncate">{displayName}</div>
              <div className="text-sm text-white/85 truncate">@{username ?? "—"}</div>
              {phone && (
                <div className="text-sm text-white/85 flex items-center gap-1 mt-0.5">
                  <Phone size={13} /> {phone}
                </div>
              )}
              <div className="text-xs text-white/70 mt-0.5">
                {role === "courier" ? "Kuryer" : role ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Shaxsiy ma'lumot */}
        <form onSubmit={saveProfile} className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <User size={16} className="text-brand" /> Shaxsiy ma'lumot
          </div>
          <p className="text-xs text-slate-400 -mt-1">
            Admin qo'shgan ism va telefon shu yerda chiqadi
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Ism Familiya</label>
            <input
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sardor Karimov"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Telefon</label>
            <input
              className={inputCls}
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="+998 90 123 45 67"
              inputMode="tel"
            />
          </div>
          {profileMsg && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                profileMsg.ok ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"
              }`}
            >
              {profileMsg.text}
            </div>
          )}
          <button type="submit" className="btn w-full justify-center" disabled={profileSaving}>
            {profileSaving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </form>

        <div className="card px-4">
          <InstallButton />
        </div>

        <div className="card px-4">
          <PushButton />
        </div>

        <form onSubmit={submitPw} className="card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
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
            {saving ? "Saqlanmoqda…" : "Parolni saqlash"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            logout();
            nav("/login");
          }}
          className="w-full py-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition"
        >
          <LogOut size={16} /> Chiqish
        </button>

        <p className="text-center text-xs text-slate-300">BB Kuryer · v1.2.0</p>
      </div>
    </>
  );
}
