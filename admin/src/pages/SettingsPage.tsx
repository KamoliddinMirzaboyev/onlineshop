import { KeyRound, Save, Truck } from "lucide-react";
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

  const load = () => {
    setErr(false);
    setLoading(true);
    get<Restaurant>("/admin/store")
      .then((s) => {
        setName(s.name ?? "");
        setMinOrder(s.min_order > 0 ? s.min_order : 50_000);
        setDeliveryPerKm(s.delivery_fee > 0 ? s.delivery_fee : 2_000);
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
        min_order: freeFrom,
        delivery_fee: perKm,
      });
      setMinOrder(updated.min_order > 0 ? updated.min_order : 50_000);
      setDeliveryPerKm(updated.delivery_fee > 0 ? updated.delivery_fee : 2_000);
      toast.success("Sozlamalar saqlandi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
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
