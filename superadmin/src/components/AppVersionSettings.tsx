import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, put } from "../api";

type AppVersionOut = {
  min_version_code: number;
  store_url: string | null;
  latest_version_code: number;
  release_notes_uz: string | null;
  release_notes_ru: string | null;
};

const APPS: { key: string; label: string }[] = [
  { key: "mijoz", label: "Mijoz ilovasi" },
  { key: "kuryer", label: "Kuryer ilovasi" },
];

function AppVersionCard({ appKey, label }: { appKey: string; label: string }) {
  const [minVersion, setMinVersion] = useState(0);
  const [storeUrl, setStoreUrl] = useState("");
  const [latest, setLatest] = useState(0);
  const [notesUz, setNotesUz] = useState("");
  const [notesRu, setNotesRu] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    get<AppVersionOut>(`/platform/app-version/${appKey}`)
      .then((d) => {
        setMinVersion(d.min_version_code);
        setStoreUrl(d.store_url ?? "");
        setLatest(d.latest_version_code ?? 0);
        setNotesUz(d.release_notes_uz ?? "");
        setNotesRu(d.release_notes_ru ?? "");
      })
      .catch(() => toast.error(`${label}: sozlamani yuklab bo'lmadi`))
      .finally(() => setLoading(false));
  }, [appKey, label]);

  const save = async () => {
    setSaving(true);
    try {
      await put(`/platform/app-version/${appKey}`, {
        min_version_code: minVersion,
        store_url: storeUrl || null,
        latest_version_code: latest,
        release_notes_uz: notesUz.trim() || null,
        release_notes_ru: notesRu.trim() || null,
      });
      toast.success(`${label}: saqlandi`);
    } catch {
      toast.error(`${label}: saqlab bo'lmadi`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Smartphone size={16} /> {label}
      </div>
      <label className="block text-xs text-slate-500">
        Minimal versiya kodi (shundan pastki build'lar bloklanadi, 0 = bloklanmaydi)
        <input
          type="number"
          min={0}
          className="input mt-1"
          value={minVersion}
          disabled={loading}
          onChange={(e) => setMinVersion(Number(e.target.value))}
        />
      </label>
      <label className="block text-xs text-slate-500">
        Oxirgi versiya kodi (undan past build'larda "Keyinroq" tugmali yangilanish modali chiqadi, 0 = chiqmaydi)
        <input
          type="number"
          min={0}
          className="input mt-1"
          value={latest}
          disabled={loading}
          onChange={(e) => setLatest(Number(e.target.value))}
        />
      </label>
      <label className="block text-xs text-slate-500">
        Yangiliklar (o'zbekcha)
        <textarea className="input mt-1" rows={2} value={notesUz} disabled={loading} onChange={(e) => setNotesUz(e.target.value)} />
      </label>
      <label className="block text-xs text-slate-500">
        Yangiliklar (ruscha)
        <textarea className="input mt-1" rows={2} value={notesRu} disabled={loading} onChange={(e) => setNotesRu(e.target.value)} />
      </label>
      <label className="block text-xs text-slate-500">
        Do'kon havolasi (Play Market / App Store; bo'sh qoldirilsa Android uchun standart havola) (bo'sh qoldirilsa standart havola ishlatiladi)
        <input
          type="text"
          className="input mt-1"
          placeholder="https://play.google.com/store/apps/details?id=..."
          value={storeUrl}
          disabled={loading}
          onChange={(e) => setStoreUrl(e.target.value)}
        />
      </label>
      <button type="button" className="btn" disabled={loading || saving} onClick={save}>
        {saving ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </div>
  );
}

export default function AppVersionSettings() {
  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-600">
        Ilova versiyasi (majburiy yangilanish)
      </h2>
      {APPS.map((a) => (
        <AppVersionCard key={a.key} appKey={a.key} label={a.label} />
      ))}
    </div>
  );
}
