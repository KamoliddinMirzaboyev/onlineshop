import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import type { LocationIssue } from "../api/client";
import { hasLocationPermissionHint } from "../api/client";
import { useI18n } from "../i18n";
import { canOpenLocationSettings, openTelegramLocationSettings } from "../telegram";

interface Props {
  issue: LocationIssue | null;
  onRetry: () => void;
}

/**
 * Joylashuv kerak bo'lganda (edge-case).
 * - Ruxsat allaqachon berilgan → avtomatik qayta urinish, "Ruxsat berish" yo'q
 * - GPS o'chiq → yoqish haqida xabar + avto-retry (visibility)
 * - Rad etilgan → Telegram sozlamalari
 */
export default function LocationNeeded({ issue, onRetry }: Props) {
  const { t } = useI18n();
  const tried = useRef(false);
  const granted = hasLocationPermissionHint() || issue === "device_off";

  // Ruxsat bor yoki GPS masalasi — tugma kutmasdan darhol qayta urinish.
  useEffect(() => {
    if (tried.current) return;
    if (issue === "denied") return;
    tried.current = true;
    const t0 = window.setTimeout(() => onRetry(), 200);
    return () => window.clearTimeout(t0);
  }, [issue, onRetry]);

  if (issue === "denied") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <MapPin size={32} className="text-tg-hint" />
        <p className="text-tg-hint">{t.location_denied}</p>
        {canOpenLocationSettings() ? (
          <button
            type="button"
            onClick={openTelegramLocationSettings}
            className="bg-brand text-white font-medium px-6 py-3 rounded-2xl active:scale-95 transition"
          >
            {t.enable_location}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="bg-brand text-white font-medium px-6 py-3 rounded-2xl active:scale-95 transition"
          >
            {t.check_again}
          </button>
        )}
      </div>
    );
  }

  if (issue === "slow") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <MapPin size={32} className="text-tg-hint" />
        <p className="text-tg-hint">{t.location_slow}</p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-brand text-white font-medium px-6 py-3 rounded-2xl active:scale-95 transition"
        >
          {t.check_again}
        </button>
      </div>
    );
  }

  if (issue === "device_off" || granted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <MapPin size={32} className="text-tg-hint" />
        <p className="text-tg-hint">{t.location_off}</p>
        <p className="text-xs text-tg-hint/80">
          {t.location_auto_hint}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-brand text-white font-medium px-6 py-3 rounded-2xl active:scale-95 transition"
        >
          {t.check_again}
        </button>
      </div>
    );
  }

  // Hali ruxsat so'ralmagan — bir marta so'rash.
  return (
    <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
      <MapPin size={32} className="text-tg-hint" />
      <p className="text-tg-hint">{t.location_needed}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-brand text-white font-medium px-6 py-3 rounded-2xl active:scale-95 transition"
      >
        {t.grant_location}
      </button>
    </div>
  );
}
