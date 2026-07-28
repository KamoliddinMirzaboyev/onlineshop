import { Check, ChevronRight, FileText, Headphones, Moon, Sun, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Address } from "../api/types";
import PageHeader from "../components/PageHeader";
import { formatUzPhone } from "../lib/format";
import { offerText, SUPPORT_HANDLE, SUPPORT_URL } from "../lib/offer";
import { useI18n, type Lang } from "../i18n";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Row({
  label, value, onClick, chevron = true,
}: { label: string; value: string; onClick?: () => void; chevron?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left disabled:opacity-100"
    >
      <span className="text-tg-text">{label}</span>
      <span className="flex items-center gap-1.5 text-tg-hint text-sm">
        {value}
        {chevron && onClick && <ChevronRight size={16} />}
      </span>
    </button>
  );
}

type EditField = "name" | "phone" | null;

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddr, setNewAddr] = useState("");
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [supportPhone, setSupportPhone] = useState<string | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.addresses().then(setAddresses).catch(() => setAddresses([]));
  useEffect(() => {
    load();
    api.store().then((s) => setSupportPhone(s?.phones?.[0] ?? null)).catch(() => {});
  }, []);

  const addAddress = async () => {
    if (!newAddr.trim()) return;
    await api.createAddress({ label: "Uy", address_line: newAddr });
    setNewAddr("");
    setShowAddrForm(false);
    load();
  };

  const startEdit = (field: EditField) => {
    setEditField(field);
    setEditValue(field === "name" ? user?.first_name ?? "" : user?.phone ?? "");
  };

  const saveEdit = async () => {
    if (!editField || saving) return;
    setSaving(true);
    try {
      const patch = editField === "name" ? { first_name: editValue.trim() } : { phone: editValue.trim() };
      const updated = await api.updateMe(patch);
      setUser(updated);
      setEditField(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-tg-bg pb-8">
      <PageHeader title={t.profile} />

      <div className="px-4 pt-6 pb-4 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-base">
          {initials(user?.first_name)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-base leading-tight truncate">{user?.first_name ?? "—"}</p>
          <p className="text-tg-hint text-sm mt-0.5">{user?.phone ?? ""}</p>
        </div>
      </div>

      <div className="mx-4 card divide-y divide-black/5">
        <Row
          label={lang === "uz" ? "Ism" : "Имя"}
          value={user?.first_name ?? "—"}
          onClick={() => startEdit("name")}
        />
        {editField === "name" && (
          <div className="flex gap-2 px-4 py-3">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 rounded-xl bg-tg-card px-3 py-2 text-sm outline-none"
            />
            <button onClick={saveEdit} disabled={saving || !editValue.trim()} className="btn-brand px-3"><Check size={16} /></button>
            <button onClick={() => setEditField(null)} className="px-3 rounded-xl bg-tg-card"><X size={16} /></button>
          </div>
        )}

        <Row
          label={t.phone}
          value={user?.phone ?? (lang === "uz" ? "Kiritilmagan" : "Не указан")}
          onClick={() => startEdit("phone")}
        />
        {editField === "phone" && (
          <div className="flex gap-2 px-4 py-3">
            <input
              autoFocus
              inputMode="tel"
              value={editValue}
              onChange={(e) => setEditValue(formatUzPhone(e.target.value))}
              placeholder="+998 88 888 88 88"
              className="flex-1 rounded-xl bg-tg-card px-3 py-2 text-sm outline-none"
            />
            <button onClick={saveEdit} disabled={saving || !editValue.trim()} className="btn-brand px-3"><Check size={16} /></button>
            <button onClick={() => setEditField(null)} className="px-3 rounded-xl bg-tg-card"><X size={16} /></button>
          </div>
        )}

        <Row
          label={t.address}
          value={addresses[0]?.address_line ?? (lang === "uz" ? "Kiritilmagan" : "Не указан")}
          onClick={() => setShowAddrForm((v) => !v)}
        />
        <Row
          label={lang === "uz" ? "Til" : "Язык"}
          value={lang === "uz" ? "O'zbekcha" : "Русский"}
          onClick={() => setLang((["uz", "ru"] as Lang[])[(["uz", "ru"] as Lang[]).indexOf(lang) === 0 ? 1 : 0])}
        />
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="flex items-center gap-2">
            {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
            {lang === "uz" ? "Mavzu" : "Тема"}
          </span>
          <div className="flex items-center gap-1 rounded-full bg-tg-card p-1">
            <button
              onClick={() => setTheme("light")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${theme === "light" ? "bg-brand text-white" : "text-tg-hint"}`}
            >
              {lang === "uz" ? "Yorug'" : "Свет."}
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${theme === "dark" ? "bg-brand text-white" : "text-tg-hint"}`}
            >
              {lang === "uz" ? "Tungi" : "Тёмн."}
            </button>
          </div>
        </div>
      </div>

      {showAddrForm && (
        <div className="mx-4 mt-3 card p-3 space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="flex justify-between items-center py-1.5">
              <span className="text-sm">{a.address_line}</span>
              <button onClick={() => api.deleteAddress(a.id).then(load)} className="text-tg-hint/70">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              value={newAddr}
              onChange={(e) => setNewAddr(e.target.value)}
              placeholder={t.address_ph}
              className="flex-1 rounded-xl bg-tg-card px-3 py-2 text-sm outline-none"
            />
            <button onClick={addAddress} className="btn-brand px-4 text-sm">{t.add}</button>
          </div>
        </div>
      )}

      <div className="mx-4 mt-4 card divide-y divide-black/5">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <Headphones size={17} className="text-tg-hint" />
          {lang === "uz" ? "Qo'llab-quvvatlash" : "Поддержка"}
          <span className="ml-auto text-brand text-sm font-medium">{SUPPORT_HANDLE}</span>
        </a>
        {supportPhone && (
          <a href={`tel:${supportPhone}`} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <Headphones size={17} className="text-tg-hint" />
            {lang === "uz" ? "Qo'ng'iroq" : "Звонок"}
            <span className="ml-auto text-tg-hint text-sm">{supportPhone}</span>
          </a>
        )}
        <button onClick={() => setShowOffer(true)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <FileText size={17} className="text-tg-hint" />
          {lang === "uz" ? "Ommaviy oferta" : "Публичная оферта"}
          <ChevronRight size={16} className="ml-auto text-tg-hint" />
        </button>
      </div>

      {user?.created_at && (
        <p className="text-center text-xs text-tg-hint mt-5">
          {(lang === "uz" ? "Ro'yxatdan o'tgan: " : "Регистрация: ") +
            new Date(user.created_at).toLocaleDateString(lang === "uz" ? "uz-UZ" : "ru-RU", {
              day: "numeric", month: "long", year: "numeric",
            })}
        </p>
      )}

      {showOffer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center" onClick={() => setShowOffer(false)}>
          <div
            className="w-full sm:max-w-lg bg-tg-bg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-black/5">
              <div>
                <h2 className="font-semibold text-lg text-tg-text">
                  {lang === "uz" ? "Ommaviy oferta" : "Публичная оферта"}
                </h2>
                <p className="text-sm text-tg-hint mt-0.5">
                  {lang === "uz" ? "Foydalanish shartlari" : "Условия использования"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOffer(false)}
                className="h-9 w-9 shrink-0 rounded-full bg-tg-card flex items-center justify-center"
                aria-label="Yopish"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {offerText(lang)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
