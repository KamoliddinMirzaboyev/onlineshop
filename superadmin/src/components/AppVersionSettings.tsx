import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, put } from "../api";

type AppVersionOut = { min_version_code: number; store_url: string | null };

const APPS: { key: string; label: string }[] = [
  { key: "mijoz", label: "Mijoz ilovasi" },
  { key: "kuryer", label: "Kuryer ilovasi" },
];

function AppVersionCard({ appKey, label }: { appKey: string; label: string }) {
  const [minVersion, setMinVersion] = useState(0);
  const [storeUrl, setStoreUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    get<AppVersionOut>(`/platform/app-version/${appKey}`)
      .then((d) => {
        setMinVersion(d.min_version_code);
        setStoreUrl(d.store_url ?? "");
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
        Play Market havolasi (bo'sh qoldirilsa standart havola ishlatiladi)
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
