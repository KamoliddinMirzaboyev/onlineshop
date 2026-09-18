import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../store";
import AppVersionSettings from "../components/AppVersionSettings";

export default function SettingsPage() {
  const { changePassword } = useAuth();
  const [newUsername, setNewUsername] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error("Yangi parol kamida 6 ta belgi bo'lsin");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Parollar mos kelmadi");
      return;
    }
    setSaving(true);
    try {
      await changePassword(oldPw, newPw, newUsername || undefined);
      toast.success("Muvaffaqiyatli o'zgartirildi");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setNewUsername("");
    } catch (err) {
      const raw = String(err);
      if (raw.includes("Eski parol")) toast.error("Eski parol noto'g'ri");
      else if (raw.includes("farq qilishi")) toast.error("Yangi parol eskisidan farq qilsin");
      else if (raw.includes("login allaqachon band")) toast.error("Bu login allaqachon band");
      else toast.error("O'zgartirib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold mb-4">Sozlamalar</h1>
      <form onSubmit={submit} className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <KeyRound size={16} /> Login va Parolni o'zgartirish
        </div>
        <input
          type="text"
          className="input"
          placeholder="Yangi login (ixtiyoriy)"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
        />
        <PasswordInput
          className="input"
          placeholder="Eski parol"
          value={oldPw}
          onChange={(e) => setOldPw(e.target.value)}
          required
        />
        <PasswordInput
          className="input"
          placeholder="Yangi parol"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          required
        />
        <PasswordInput
          className="input"
          placeholder="Yangi parolni takrorlang"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          required
        />
        <button type="submit" disabled={saving} className="btn">
          <KeyRound size={16} /> {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </form>

      <AppVersionSettings />
    </div>
  );
}
