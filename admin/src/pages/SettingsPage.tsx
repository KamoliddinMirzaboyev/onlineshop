import { KeyRound, Phone, Save, Send, Truck } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, put } from "../api";
import { ErrorRetry } from "../components/Skeleton";
import { useAuth } from "../store";
import type { Restaurant } from "../types";

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

export default function SettingsPage() {
  const { changePassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // name backend majburiy — UI yo'q, load'dan saqlanadi
  const [name, setName] = useState("");
  const [minOrder, setMinOrder] = useState(50_000);
  const [deliveryPerKm, setDeliveryPerKm] = useState(2_000);
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [telegram, setTelegram] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [contactSaving, setContactSaving] = useState(false);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<Restaurant>("/admin/store")
      .then((s) => {
        setName(s.name ?? "");
        setMinOrder(s.free_delivery_from > 0 ? s.free_delivery_from : 50_000);
        setDeliveryPerKm(s.delivery_fee > 0 ? s.delivery_fee : 2_000);
        setPhone1(s.phones?.[0] ?? "");
        setPhone2(s.phones?.[1] ?? "");
        setSocials(s.socials ?? {});
        setTelegram((s.socials?.telegram ?? "").replace(/^@/, ""));
        setLoading(false);
      })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const freeFrom = Math.max(0, Math.round(Number(minOrder)) || 0);
    const perKm = Math.max(0, Math.round(Number(deliveryPerKm)) || 0);
    if (perKm <= 0) {
      toast.error("1 km narxi 0 dan katta bo'lsin");
      return;
    }

    setSaving(true);
    try {
      const updated = await put<Restaurant>("/admin/store", {
        name: name || "Do'kon",
        free_delivery_from: freeFrom,
        delivery_fee: perKm,
      });
      setMinOrder(updated.free_delivery_from > 0 ? updated.free_delivery_from : 50_000);
      setDeliveryPerKm(updated.delivery_fee > 0 ? updated.delivery_fee : 2_000);
      toast.success("Sozlamalar saqlandi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    setContactSaving(true);
    try {
      const phones = [phone1, phone2].map((p) => p.trim()).filter(Boolean);
      const nextSocials = { ...socials };
      const tgClean = telegram.trim().replace(/^@/, "");
      if (tgClean) nextSocials.telegram = tgClean;
      else delete nextSocials.telegram;
      await put<Restaurant>("/admin/store", { name: name || "Do'kon", phones, socials: nextSocials });
      setSocials(nextSocials);
      toast.success("Bog'lanish ma'lumotlari saqlandi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setContactSaving(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error("Yangi parol kamida 6 ta belgi bo'lsin");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Parollar mos kelmadi");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(oldPw, newPw);
      toast.success("Parol o'zgartirildi");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const raw = String(err);
      if (raw.includes("Eski parol")) toast.error("Eski parol noto'g'ri");
      else if (raw.includes("farq qilishi")) toast.error("Yangi parol eskisidan farq qilsin");
      else toast.error("Parolni o'zgartirib bo'lmadi");
    } finally {
      setPwSaving(false);
    }
  };

  if (err) return <ErrorRetry onRetry={load} />;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Do'kon sozlamalari</h1>
        <p className="text-slate-500">Yetkazish narxi va parol.</p>
      </div>

      {loading ? (
        <div className="card p-6 text-slate-400">Yuklanmoqda…</div>
      ) : (
        <div className="space-y-4">
          {/* Yetkazish */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Truck size={18} className="text-brand" /> Yetkazish narxi
            </h2>
            <p className="text-sm text-slate-500">
              Buyurtma summasi bepul chegaradan past bo‘lsa:{" "}
              <span className="font-medium text-slate-700">masofa (km) × 1 km narxi</span>.
              Teng yoki yuqori bo‘lsa — yetkazish bepul.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bepul yetkazish chegarasi (so‘m)
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={minOrder}
                  onChange={(e) => setMinOrder(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Hozir: {money(minOrder)} so‘m va undan yuqori — bepul
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  1 km narxi (so‘m)
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={100}
                  value={deliveryPerKm}
                  onChange={(e) => setDeliveryPerKm(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Masalan 3 km × {money(deliveryPerKm || 0)} = {money(3 * (deliveryPerKm || 0))} so‘m
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600">
              Misol: savat {money(Math.max(0, minOrder - 1_000))} so‘m, masofa 4 km → yetkazish{" "}
              <span className="font-semibold text-slate-900">{money(4 * (deliveryPerKm || 0))} so‘m</span>
              {minOrder > 0 && (
                <>
                  {" · "}savat {money(minOrder)}+ so‘m →{" "}
                  <span className="font-semibold text-emerald-600">bepul</span>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="btn">
              <Save size={16} /> {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>

          {/* Bog'lanish — mijozlarga TMA va botda ko'rsatiladi */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Phone size={18} className="text-brand" /> Bog'lanish
            </h2>
            <p className="text-sm text-slate-500">
              Mijozlar TMA profil sahifasi va botda buyurtma bo'yicha shu orqali bog'lanadi.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon 1</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+998901234567"
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon 2 (ixtiyoriy)</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+998901234567"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                  <Send size={14} /> Telegram username
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 rounded-l-xl bg-slate-100 text-slate-500 border border-r-0 border-slate-200 text-sm">@</span>
                  <input
                    className="input rounded-l-none"
                    placeholder="username"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value.replace(/^@/, ""))}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={saveContact} disabled={contactSaving} className="btn">
                <Save size={16} /> {contactSaving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </div>

          {/* Parol */}
          <form onSubmit={submitPassword} className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <KeyRound size={16} /> Parolni o'zgartirish
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Eski parol</label>
                <PasswordInput
                  className="input"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Yangi parol</label>
                <PasswordInput
                  className="input"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Yangi parolni takrorlang</label>
                <PasswordInput
                  className="input"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={pwSaving} className="btn">
                <KeyRound size={16} /> {pwSaving ? "Saqlanmoqda…" : "Parolni saqlash"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
