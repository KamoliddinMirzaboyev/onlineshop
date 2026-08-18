import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";

const TASHKENT: [number, number] = [41.2995, 69.2401];

interface Props {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

/** Xaritadan qo'lda joy tanlash — markazdagi pin, xaritani surib joyni belgilaydi. */
export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }: Props) {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);

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
    mapObj.current = map;
    return () => {
      map.remove();
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = () => {
    const c = mapObj.current?.getCenter();
    if (!c) return;
    onConfirm(c.lat, c.lng);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-medium text-slate-900">{t.address_pick_map}</span>
        <button type="button" onClick={onClose} className="p-1 text-slate-400">
          <X size={22} />
        </button>
      </div>

      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />
        <MapPin
          size={36}
          className="pointer-events-none absolute left-1/2 top-1/2 text-brand drop-shadow"
          style={{ transform: "translate(-50%, -100%)" }}
          fill="currentColor"
        />
      </div>

      <div className="p-4 border-t border-slate-100">
        <button
          type="button"
          onClick={confirm}
          className="w-full rounded-[16px] bg-brand text-white text-base font-semibold py-4"
        >
          {t.address_pick_confirm}
        </button>
      </div>
    </div>
  );
}
