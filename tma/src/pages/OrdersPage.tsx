import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Order } from "../api/types";
import ErrorState from "../components/ErrorState";
import OptimizedImage from "../components/OptimizedImage";
import { OrderListSkeleton } from "../components/Skeleton";
import StatusBadge from "../components/StatusBadge";
import { useI18n } from "../i18n";
import { money } from "../lib/format";

const POLL_INTERVAL_MS = 15000;

export default function OrdersPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    api
      .myOrders()
      .then((o) => {
        setOrders(o);
        setLoading(false);
      })
      .catch(() => {
        if (!silent) setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // Kuryer statusni o'zgartirsa, ro'yxat jonli yangilanib tursin.
    const iv = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  if (error) return <ErrorState onRetry={() => load()} />;
  if (loading) return <OrderListSkeleton />;

  if (orders.length === 0) {
    return (
      <div className="p-10 text-center text-tg-hint">
        <div className="text-5xl mb-3">🧾</div>
        {t.no_orders}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">{t.orders}</h1>
      <div className="space-y-3">
        {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => nav(`/orders/${o.id}`)}
              className="card p-4 w-full text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">№ {o.number}</span>
                <StatusBadge status={o.status} />
              </div>

              <div className="text-xs text-tg-hint mt-0.5">
                {new Date(o.created_at).toLocaleString()}
              </div>

              {/* Mahsulot rasmlari */}
              <div className="flex items-center gap-1.5 mt-3">
                {o.items.slice(0, 5).map((it) =>
                  it.image_url ? (
                    <OptimizedImage key={it.id} src={it.image_url} className="h-10 w-10 rounded-lg object-cover bg-tg-card shrink-0" />
                  ) : (
                    <div key={it.id} className="h-10 w-10 rounded-lg bg-tg-card flex items-center justify-center text-sm shrink-0">🍽</div>
                  )
                )}
                {o.items.length > 5 && (
                  <span className="text-xs text-tg-hint">+{o.items.length - 5}</span>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
                <span className="text-sm text-tg-hint">
                  {o.items.length} {t.products_n}
                </span>
                <span className="font-semibold">
                  {money(o.total)} {t.sum}
                </span>
              </div>

            </button>
        ))}
      </div>
    </div>
  );
}
