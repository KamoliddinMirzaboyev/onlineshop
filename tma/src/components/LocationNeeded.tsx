import { MapPin } from "lucide-react";
import type { LocationIssue } from "../api/client";
import { useI18n } from "../i18n";
import { openTelegramLocationSettings } from "../telegram";

interface Props {
  issue: LocationIssue | null;
  onRetry: () => void;
}

/** Do'konni joylashuv bo'yicha yuklab bo'lmaganda ko'rsatiladi — hech qachon
 * xarita ochilmaydi, faqat holatga mos ravishda ruxsat so'raladi yoki
 * sozlamaga yo'naltiriladi.
 *
 * MUHIM: Telegram'ning openSettings() metodi faqat botning Telegram ICHIDAGI
 * ruxsat ekranini ochadi ("denied" holati) — qurilmaning OS darajasidagi
 * GPS/Location Services tumblerini ESLATMA OCHMAYDI ("device_off" holati).
 * Mini App'dan OS sozlamalariga bunday deep-link umuman mavjud emas (Telegram
 * sandbox'i buni taqiqlaydi), shu sabab "device_off" holatida foydalanuvchini
 * noto'g'ri ekranga yubormaymiz — faqat telefon sozlamalarini o'zi ochishini
 * aytamiz va "Qayta tekshirish" beramiz (yoqib qaytganda avtomatik ham
 * tekshiriladi — useStore'dagi visibilitychange orqali). */
export default function LocationNeeded({ issue, onRetry }: Props) {
  const { t } = useI18n();

  if (issue === "device_off") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <MapPin size={32} className="text-tg-hint" />
        <p className="text-tg-hint">{t.location_off}</p>
        <button
          onClick={onRetry}
          className="bg-brand text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition"
        >
          {t.check_again}
        </button>
      </div>
    );
  }

  if (issue === "denied") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <MapPin size={32} className="text-tg-hint" />
        <p className="text-tg-hint">{t.location_denied}</p>
        <button
          onClick={openTelegramLocationSettings}
          className="bg-brand text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition"
        >
          {t.enable_location}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
      <MapPin size={32} className="text-tg-hint" />
      <p className="text-tg-hint">{t.location_needed}</p>
      <button
        onClick={onRetry}
        className="bg-brand text-white font-semibold px-6 py-3 rounded-2xl active:scale-95 transition"
      >
        {t.grant_location}
      </button>
    </div>
  );
}
