import { Megaphone, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AppNotification } from "../api/types";
import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import { useI18n } from "../i18n";

function timeLabel(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === "uz" ? "uz-UZ" : "ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { lang } = useI18n();
  const nav = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    setLoading(true);
    api
      .notifications()
      .then((res) => {
        setItems(res);
        setLoading(false);
        if (res.some((n) => !n.is_read)) {
          api.markNotificationsRead().catch(() => {});
        }
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(load, []);

  return (
    <div className="min-h-full bg-tg-bg pb-24">
      <PageHeader title={lang === "uz" ? "Bildirishnomalar" : "Уведомления"} back />

      {error ? (
        <ErrorState onRetry={load} />
      ) : loading ? (
        <div className="p-10 text-center text-tg-hint">…</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-tg-hint">
          <div className="text-5xl mb-3">🔔</div>
          {lang === "uz" ? "Bildirishnoma yo'q" : "Уведомлений нет"}
        </div>
      ) : (
        <div className="p-4 space-y-2.5">
          {items.map((n) => {
            const broadcast = n.kind === "broadcast";
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => n.order_id && nav(`/orders/${n.order_id}`)}
                className="card p-4 w-full text-left flex items-start gap-3"
              >
                <span
                  className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
                    broadcast ? "bg-amber-100 text-amber-600" : "bg-brand-light/40 text-brand"
                  }`}
                >
                  {broadcast ? <Megaphone size={17} /> : <Truck size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[13.5px] leading-snug ${n.is_read ? "font-medium" : "font-bold"} text-tg-text`}>
                      {n.title}
                    </p>
                    {!n.is_read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />}
                  </div>
                  <p className="text-[12.5px] text-tg-hint mt-0.5 leading-snug line-clamp-3">{n.body}</p>
                  <p className="text-[11px] text-tg-hint/70 mt-1.5">{timeLabel(n.created_at, lang)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
