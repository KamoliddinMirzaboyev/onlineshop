import { AtSign, Camera, Globe, KeyRound, PlayCircle, Plus, Save, Send, Trash2, Bell, BellOff, BellRing } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, put } from "../api";
import ImageUpload from "../components/ImageUpload";
import { ErrorRetry } from "../components/Skeleton";
import { useAuth } from "../store";
import type { Restaurant } from "../types";
import { enablePush, disablePush, pushSupported } from "../push";

// Qo'llab-quvvatlanadigan ijtimoiy tarmoqlar (key backendda socials obyekti kaliti).
const SOCIALS: { key: string; label: string; icon: typeof Globe; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", icon: Camera, placeholder: "https://instagram.com/allfoods" },
  { key: "telegram", label: "Telegram", icon: Send, placeholder: "https://t.me/allfoods" },
  { key: "facebook", label: "Facebook", icon: AtSign, placeholder: "https://facebook.com/allfoods" },
  { key: "youtube", label: "YouTube", icon: PlayCircle, placeholder: "https://youtube.com/@allfoods" },
  { key: "website", label: "Veb-sayt", icon: Globe, placeholder: "https://allfoods.uz" },
];

export default function SettingsPage() {
  const { changePassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => setPushEnabled(!!sub));
  }, []);
  const [pushBusy, setPushBusy] = useState(false);

  const togglePush = async () => {
    if (!pushSupported() || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushEnabled) {
         await disablePush();
         const reg = await navigator.serviceWorker.ready;
         const sub = await reg.pushManager.getSubscription();
         if (sub) await sub.unsubscribe();
         setPushEnabled(false);
      } else {
         const p = await enablePush();
         if (p === "granted") setPushEnabled(true);
      }
    } catch {
      toast.error("Amalni bajarib bo'lmadi");
    } finally {
      setPushBusy(false);
    }
  };

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [name, setName] = useState("");
  const [descUz, setDescUz] = useState("");
  const [descRu, setDescRu] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [owner, setOwner] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [minOrder, setMinOrder] = useState(50_000);
  const [deliveryPerKm, setDeliveryPerKm] = useState(2_000);

  const load = () => {
    setErr(false);
    setLoading(true);
    get<Restaurant>("/admin/store")
      .then((s) => {
        setName(s.name ?? "");
        setDescUz(s.description_uz ?? "");
        setDescRu(s.description_ru ?? "");
        setLogo(s.logo_url ?? null);
        setCover(s.cover_url ?? null);
        setAddress(s.address ?? "");
        setOwner(s.owner_name ?? "");
        setPhones(s.phones?.length ? s.phones : [""]);
        setSocials(s.socials ?? {});
        setMinOrder(s.min_order > 0 ? s.min_order : 50_000);
        setDeliveryPerKm(s.delivery_fee > 0 ? s.delivery_fee : 2_000);
        setLoading(false);
      })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const setPhone = (i: number, v: string) =>
    setPhones((p) => p.map((x, idx) => (idx === i ? v : x)));
  const addPhone = () => setPhones((p) => [...p, ""]);
  const removePhone = (i: number) =>
    setPhones((p) => (p.length === 1 ? [""] : p.filter((_, idx) => idx !== i)));

  const setSocial = (key: string, v: string) =>
    setSocials((s) => ({ ...s, [key]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const cleanSocials = Object.fromEntries(
        Object.entries(socials).filter(([, v]) => v.trim()),
      );
      const updated = await put<Restaurant>("/admin/store", {
        name: name.trim(),
        description_uz: descUz.trim() || null,
        description_ru: descRu.trim() || null,
        logo_url: logo,
        cover_url: cover,
        address: address.trim() || null,
        owner_name: owner.trim() || null,
        phones: phones.map((p) => p.trim()).filter(Boolean),
        socials: cleanSocials,
        min_order: Math.max(0, Math.round(minOrder) || 0),
        delivery_fee: Math.max(0, Math.round(deliveryPerKm) || 0),
      });
      setPhones(updated.phones?.length ? updated.phones : [""]);
      setSocials(updated.socials ?? {});
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Do'kon sozlamalari</h1>
          <p className="text-slate-500">Do'kon nomi, logosi, manzili va aloqa ma'lumotlari.</p>
        </div>
        {pushSupported() && (
          <div className="card px-4 py-3 flex flex-row items-center justify-between md:justify-start gap-6 bg-white shadow-sm border border-slate-100 min-w-64">
             <div className="flex items-center gap-3 text-slate-700">
               {pushEnabled ? <BellRing size={20} className="text-emerald-500" /> : <Bell size={20} className="text-amber-500" />}
               <div className="text-sm font-semibold">
                 {pushEnabled ? "Bildirishnomalar yoniq" : "Bildirishnomani yoqish"}
               </div>
             </div>
             <button 
                onClick={togglePush} 
                disabled={pushBusy} 
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${pushEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
             >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${perm === "granted" ? 'translate-x-5' : 'translate-x-0'}`} />
             </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card p-6 text-slate-400">Yuklanmoqda…</div>
      ) : (
        <div className="space-y-4">
          {/* Brending */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Brending</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <ImageUpload label="Logo" value={logo} onChange={setLogo} heightClass="h-32" />
              <ImageUpload label="Muqova (cover)" value={cover} onChange={setCover} heightClass="h-32" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Do'kon nomi</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tavsif (uz)</label>
                <textarea className="input min-h-[80px]" value={descUz} onChange={(e) => setDescUz(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tavsif (ru)</label>
                <textarea className="input min-h-[80px]" value={descRu} onChange={(e) => setDescRu(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Aloqa */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Aloqa</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manzil</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Farg'ona sh., ..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ega (rahbar) ismi</label>
              <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefon raqamlari</label>
              <div className="space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={p}
                      onChange={(e) => setPhone(i, e.target.value)}
                      placeholder="+998 90 123 45 67"
                    />
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="icon-btn text-red-500 shrink-0"
                      title="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPhone} className="btn-ghost mt-2 text-sm">
                <Plus size={15} /> Raqam qo'shish
              </button>
            </div>
          </div>

          {/* Yetkazish */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">Yetkazish narxi</h2>
            <p className="text-sm text-slate-500">
              Mahsulotlar jami bu summadan kam bo‘lsa — har km uchun to‘lov; teng yoki yuqori bo‘lsa — yetkazish bepul.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bepul yetkazish (so‘m)
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={minOrder}
                  onChange={(e) => setMinOrder(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">Masalan 50000 — shu summadan bepul</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  1 km narxi (so‘m)
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={100}
                  value={deliveryPerKm}
                  onChange={(e) => setDeliveryPerKm(Number(e.target.value))}
                />
                <p className="text-xs text-slate-400 mt-1">Masalan 2000 — har km ga 2000 so‘m</p>
              </div>
            </div>
          </div>

          {/* Ijtimoiy tarmoqlar */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-800">Ijtimoiy tarmoqlar</h2>
            {SOCIALS.map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                  <Icon size={15} /> {label}
                </label>
                <input
                  className="input"
                  value={socials[key] ?? ""}
                  onChange={(e) => setSocial(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving || !name.trim()} className="btn">
              <Save size={16} /> {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>

          {/* Parolni o'zgartirish */}
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
