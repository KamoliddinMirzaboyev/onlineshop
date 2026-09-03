import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCoords } from "../api/client";
import { useI18n } from "../i18n";

const TASHKENT: [number, number] = [41.2995, 69.2401];

interface Props {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
  /** Nuqtani tekshirish; xato matn qaytsa tasdiqlanmaydi (masalan hudud tashqarisi). */
  validate?: (lat: number, lng: number) => Promise<string | null>;
}

/** Xaritadan qo'lda joy tanlash — markazdagi pin, xaritani surib joyni belgilaydi. */
export default function MapPicker({ initialLat, initialLng, onConfirm, onClose, validate }: Props) {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Boshlanish nuqtasi GPS'dan kelgan bo'lsa ishonchli; aks holda default (Toshkent)
  // markazini yuborib qo'ymaslik uchun foydalanuvchi xaritani surishi shart.
  const [touched, setTouched] = useState(initialLat != null && initialLng != null);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const center: [number, number] =
      initialLat != null && initialLng != null ? [initialLat, initialLng] : TASHKENT;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(
      center,
      17,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    map.on("movestart", () => {
      setTouched(true);
      setError(null);
    });
    mapObj.current = map;
    // Konteyner o'lchami layout tugagach aniq bo'ladi — aks holda xarita yarim/kul rang.
    const inv = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(inv);
      map.remove();
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    const c = mapObj.current?.getCenter();
    if (!c || checking) return;
    if (validate) {
      setChecking(true);
      try {
        const msg = await validate(c.lat, c.lng);
        if (msg) {
          setError(msg);
          return;
        }
      } finally {
        setChecking(false);
      }
    }
    onConfirm(c.lat, c.lng);
  };

  const locateMe = async () => {
    setLocating(true);
    const c = await getCoords({ force: true, highAccuracy: true });
    setLocating(false);
    if (c) {
      mapObj.current?.setView([c.lat, c.lng], 17);
      setTouched(true);
      setError(null);
    }
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 bg-white flex flex-col"
      style={{ height: "100dvh" }}
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-medium text-slate-900">{t.address_pick_map}</span>
        <button type="button" onClick={onClose} className="p-1 text-slate-400">
          <X size={22} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={mapRef} className="absolute inset-0" />

        <p className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow">
          {t.address_pick_hint}
        </p>

        <MapPin
          size={36}
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] text-brand drop-shadow"
          style={{ transform: "translate(-50%, -100%)" }}
          fill="currentColor"
        />

        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-label={t.address_locate_me}
          className="absolute bottom-4 right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-lg disabled:opacity-50"
        >
          <LocateFixed size={22} className={locating ? "animate-pulse" : ""} />
        </button>
      </div>

      <div className="shrink-0 p-4 border-t border-slate-100 space-y-2">
        {error ? (
          <p className="text-center text-sm font-medium text-rose-500">{error}</p>
        ) : !touched ? (
          <p className="text-center text-xs text-slate-400">{t.address_pick_move_first}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!touched || checking}
          className="w-full rounded-[16px] bg-brand text-white text-base font-semibold py-4 disabled:opacity-50"
        >
          {checking ? "…" : t.address_pick_confirm}
        </button>
      </div>
    </div>
  );
}
