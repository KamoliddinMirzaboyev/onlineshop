import { Map, Navigation, X } from "lucide-react";
import { createPortal } from "react-dom";
import { googleMapsNavUrl, yandexMapsNavUrl } from "../lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
};

export default function NavChooser({ open, onClose, lat, lng, address }: Props) {
  if (!open) return null;

  const google = googleMapsNavUrl(lat, lng, address);
  const yandex = yandexMapsNavUrl(lat, lng, address);
  const subtitle =
    address?.trim() ||
    (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Manzil");

  const openUrl = (url: string | null) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Yopish"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[slideUp_.2s_ease-out]">
        <div className="flex justify-center mb-3">
          <span className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Navigatsiya</h3>
            <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-slate-100 grid place-items-center text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            disabled={!google}
            onClick={() => openUrl(google)}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-left active:scale-[0.99] transition disabled:opacity-40"
          >
            <span className="h-11 w-11 rounded-xl bg-blue-50 text-[#4285F4] grid place-items-center shrink-0">
              <Map size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-slate-900">Google Maps</span>
              <span className="block text-xs text-slate-400">Marshrut ochish</span>
            </span>
            <Navigation size={16} className="text-slate-300" />
          </button>

          <button
            type="button"
            disabled={!yandex}
            onClick={() => openUrl(yandex)}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-left active:scale-[0.99] transition disabled:opacity-40"
          >
            <span className="h-11 w-11 rounded-xl bg-red-50 text-[#FC3F1D] grid place-items-center shrink-0">
              <Navigation size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-slate-900">Yandex Navigator</span>
              <span className="block text-xs text-slate-400">Yandex xarita / navigator</span>
            </span>
            <Navigation size={16} className="text-slate-300" />
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
