import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";
import { get, put } from "../api";
import type { DeliveryZone } from "../types";

// Default: Farg'ona shahar markazi.
const DEFAULT_CENTER: [number, number] = [40.3864, 71.7864];

function ClickToSetCenter({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// "Joylashuvni aniqlash" bosilganda xarita markazga o'zi ko'chib o'tishi uchun —
// `center` prop faqat MapContainer mount'ida ishlaydi, keyingi o'zgarishda emas.
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
}

export default function DeliveryZonePage() {
  const [name, setName] = useState("Yetkazish hududi");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(5);
  const [fee, setFee] = useState(0);
  const [minOrder, setMinOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [hasCenter, setHasCenter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Brauzeringiz joylashuvni aniqlay olmaydi");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setHasCenter(true);
        setLocating(false);
      },
      () => {
        toast.error("Joylashuvni aniqlab bo'lmadi — brauzerda ruxsat berilganini tekshiring");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    get<DeliveryZone | null>("/admin/delivery-zone")
      .then((z) => {
        if (z) {
          setName(z.name || "Yetkazish hududi");
          setFee(z.fee ?? 0);
          setMinOrder(z.min_order ?? 0);
          setActive(z.is_active);
          if (z.radius_km) setRadiusKm(z.radius_km);
          if (z.center_lat != null && z.center_lng != null) {
            setCenter([z.center_lat, z.center_lng]);
            setHasCenter(true);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await put<DeliveryZone>("/admin/delivery-zone", {
        name,
        fee,
        min_order: minOrder,
        is_active: active,
        center_lat: center[0],
        center_lng: center[1],
        radius_km: radiusKm,
      });
      setHasCenter(true);
      toast.success("Yetkazish hududi saqlandi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Yetkazish hududi</h1>
      <p className="text-slate-500 mb-5">
        Xaritani bosib markazni belgilang, radiusni sozlang. Hudud tashqarisidagi
        buyurtmalar qabul qilinmaydi.
      </p>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 card overflow-hidden" style={{ height: 460 }}>
          {!loading && (
            <MapContainer
              center={center}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickToSetCenter onPick={(lat, lng) => setCenter([lat, lng])} />
              <Recenter center={center} />
              <Circle
                center={center}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#16A34A", fillColor: "#16A34A", fillOpacity: 0.12 }}
              />
              <CircleMarker
                center={center}
                radius={6}
                pathOptions={{ color: "#16A34A", fillColor: "#16A34A", fillOpacity: 1 }}
              />
            </MapContainer>
          )}
        </div>

        {/* Controls */}
        <div className="card p-5 space-y-4 h-fit">
          <button
            onClick={locate}
            disabled={locating}
            className="btn-ghost w-full justify-center"
          >
            <LocateFixed size={16} /> {locating ? "Aniqlanmoqda…" : "Joylashuvni aniqlash"}
          </button>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nomi</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Radius: <span className="font-bold text-brand">{radiusKm} km</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={30}
              step={0.5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Markaz lat</label>
              <input
                className="input"
                type="number"
                value={center[0]}
                onChange={(e) => setCenter([Number(e.target.value), center[1]])}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Markaz lng</label>
              <input
                className="input"
                type="number"
                value={center[1]}
                onChange={(e) => setCenter([center[0], Number(e.target.value)])}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-brand h-4 w-4"
            />
            Hudud faol (tekshiruv yoqilgan)
          </label>

          {!hasCenter && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <MapPin size={13} /> Markaz belgilanmagan — xaritani bosing.
            </p>
          )}

          <button onClick={save} disabled={saving} className="btn w-full justify-center">
            <Save size={16} /> {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
