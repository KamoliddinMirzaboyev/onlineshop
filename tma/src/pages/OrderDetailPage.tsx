import { Check, CheckCircle2, Clock, CreditCard, MapPin, MessageCircle, Phone, Printer, ShoppingBag, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Order, RestaurantDetail } from "../api/types";
import ErrorState from "../components/ErrorState";
import OptimizedImage from "../components/OptimizedImage";
import { OrderDetailSkeleton } from "../components/Skeleton";
import StatusBadge from "../components/StatusBadge";
import { loc, useI18n } from "../i18n";
import { money, qtyUnit } from "../lib/format";

const STAGES = ["confirmed", "delivering", "delivered"] as const;
const TERMINAL = new Set(["delivered", "cancelled"]);

/** 8 ta ichki holatni 3 ko'rinadigan bosqichga siqamiz. */
function stageIndex(status: string): number {
  if (status === "delivered") return 2;
  if (status === "delivering") return 1;
  return 0; // pending, confirmed, preparing, ready, accepted
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (!order) return;
    api.restaurant(order.restaurant_id).then(setStore).catch(() => {});
  }, [order?.restaurant_id]);

  useEffect(() => {
    if (!id) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const load = () =>
      api
        .order(Number(id))
        .then((o) => {
          setOrder(o);
          setError(false);
          if (iv && TERMINAL.has(o.status)) clearInterval(iv);
        })
        .catch(() => setError(true));
    load();
    iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [id]);

  useEffect(() => {
    if (!showReceipt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowReceipt(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showReceipt]);

  if (error && !order) return <ErrorState onRetry={() => window.location.reload()} />;
  if (!order) return <OrderDetailSkeleton />;

  const curStage = stageIndex(order.status);
  const isDelivered = order.status === "delivered";
  const isCancelled = order.status === "cancelled";
  const justPlaced = searchParams.get("placed") === "1";
  const payLabel = order.payment_method === "card" ? t.pay_card : t.pay_cash;

  return (
    <div className="p-4 pb-8">
      <button onClick={() => nav("/orders")} className="text-brand mb-3">← {t.orders}</button>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">№ {order.number}</h1>
        <StatusBadge status={order.status} />
      </div>

      {justPlaced && !isCancelled && (
        <div className="mt-4 rounded-3xl bg-emerald-50 border border-emerald-100 px-4 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="shrink-0 h-11 w-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-200">
              <CheckCircle2 size={25} />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-emerald-800">
                {lang === "uz" ? "Buyurtma yuborildi" : "Заказ отправлен"}
              </div>
              <p className="text-sm text-emerald-700 mt-0.5 leading-snug">
                {lang === "uz"
                  ? `№ ${order.number} buyurtmangiz qabul qilindi. Kuryer tez orada qabul qiladi.`
                  : `Заказ № ${order.number} принят. Курьер скоро примет заказ.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Xaridni davom ettirish — buyurtma berilgach darhol ko'rinadi */}
      <button
        onClick={() => nav("/")}
        className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-tg-card text-brand font-semibold active:scale-[0.98] transition"
      >
        <ShoppingBag size={18} />
        {t.back_to_menu}
      </button>

      {/* 3-bosqichli progress */}
      {isCancelled ? (
        <div className="mt-4 mb-5 flex items-center gap-2 rounded-2xl bg-red-50 text-red-600 px-4 py-3">
          <XCircle size={20} />
          <span className="font-semibold">{t.cancelled_note}</span>
        </div>
      ) : (
        <div className="mt-6 mb-7 flex items-start">
          {STAGES.map((s, i) => {
            const done = i < curStage;
            const active = i === curStage;
            return (
              <div key={s} className="flex-1 flex flex-col items-center relative">
                {/* ulagich chiziq (chapdan) */}
                {i > 0 && (
                  <span
                    className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${
                      i <= curStage ? "bg-brand" : "bg-tg-card"
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition ${
                    done || active ? "bg-brand text-white" : "bg-tg-card text-tg-hint"
                  } ${active ? "ring-4 ring-brand/20" : ""}`}
                >
                  {done ? <Check size={16} /> : i + 1}
                </div>
                <span
                  className={`text-xs mt-1.5 text-center leading-tight ${
                    i <= curStage ? "text-tg-text font-medium" : "text-tg-hint"
                  }`}
                >
                  {t.stages[s]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Mahsulotlar */}
      <div className="card p-4 space-y-3">
        {order.items.map((it) => (
          <div key={it.id} className="flex items-start gap-3 text-sm">
            {it.image_url ? (
              <OptimizedImage src={it.image_url} className="h-12 w-12 rounded-xl object-cover bg-tg-card shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-tg-card flex items-center justify-center text-lg shrink-0">🍽</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{loc(it, "name", lang)}</div>
              <div className="text-xs text-tg-hint">
                {qtyUnit(it.quantity, it.unit, lang)} × {money(it.price)} {t.sum}
              </div>
              {it.note && (
                <div className="text-xs text-brand-dark bg-brand-light/50 rounded-lg px-2 py-1 mt-1 flex items-center gap-1">
                  💬 {it.note}
                </div>
              )}
            </div>
            <span className="font-semibold shrink-0">{money(it.price * it.quantity)} {t.sum}</span>
          </div>
        ))}
        <hr className="border-black/10" />
        <div className="flex justify-between text-sm text-tg-hint">
          <span>{t.delivery}</span>
          <span>{order.delivery_fee === 0 ? t.free : `${money(order.delivery_fee)} ${t.sum}`}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>{t.total}</span>
          <span>{money(order.total)} {t.sum}</span>
        </div>
      </div>

      {/* Masofa + taxminiy yetkazib berish vaqti */}
      {(order.distance_km != null || order.eta_minutes != null) && (
        <div className="mt-4 flex gap-3">
          {order.distance_km != null && (
            <div className="flex-1 card px-3 py-2.5 text-center">
              <div className="text-xs text-tg-hint">{lang === "uz" ? "Masofa" : "Расстояние"}</div>
              <div className="font-medium text-sm mt-0.5">
                {order.distance_km < 1
                  ? `${Math.round(order.distance_km * 1000)} m`
                  : `${order.distance_km.toFixed(1)} km`}
              </div>
            </div>
          )}
          {order.eta_minutes != null && (
            <div className="flex-1 card px-3 py-2.5 text-center">
              <div className="text-xs text-tg-hint">{lang === "uz" ? "Taxminiy vaqt" : "Время"}</div>
              <div className="font-medium text-sm mt-0.5 text-brand">~{order.eta_minutes} {t.min}</div>
            </div>
          )}
        </div>
      )}

      {/* Kuryer — buyurtmani qabul qilgach ismi/raqami ko'rinadi */}
      {order.assigned_courier_name && (
        <div className="mt-4 card p-4 flex items-center gap-3">
          <span className="shrink-0 h-10 w-10 rounded-full bg-brand-light/40 text-brand flex items-center justify-center">
            <User size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-tg-hint">{lang === "uz" ? "Kuryer" : "Курьер"}</div>
            <div className="font-semibold text-sm truncate">{order.assigned_courier_name}</div>
          </div>
          {order.assigned_courier_phone && (
            <a
              href={`tel:${order.assigned_courier_phone}`}
              className="shrink-0 h-10 w-10 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition"
            >
              <Phone size={16} />
            </a>
          )}
        </div>
      )}

      <div className="mt-4 card p-4 space-y-3.5">
        <div className="flex items-start gap-3">
          <span className="shrink-0 h-8 w-8 rounded-full bg-brand-light/40 text-brand flex items-center justify-center">
            <MapPin size={16} />
          </span>
          <span className="text-sm leading-tight pt-1.5">{order.address_line}</span>
        </div>
        {order.phone && (
          <div className="flex items-center gap-3">
            <span className="shrink-0 h-8 w-8 rounded-full bg-brand-light/40 text-brand flex items-center justify-center">
              <Phone size={16} />
            </span>
            <span className="text-sm">{order.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="shrink-0 h-8 w-8 rounded-full bg-brand-light/40 text-brand flex items-center justify-center">
            <CreditCard size={16} />
          </span>
          <span className="text-sm">{payLabel}</span>
        </div>
        {order.comment && (
          <div className="flex items-start gap-3">
            <span className="shrink-0 h-8 w-8 rounded-full bg-brand-light/40 text-brand flex items-center justify-center">
              <MessageCircle size={16} />
            </span>
            <span className="text-sm leading-tight pt-1.5">{order.comment}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="shrink-0 h-8 w-8 rounded-full bg-brand-light/40 text-brand flex items-center justify-center">
            <Clock size={16} />
          </span>
          <span className="text-sm text-tg-hint">{new Date(order.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Chekni ko'rish */}
      <button
        onClick={() => setShowReceipt(true)}
        className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm text-tg-hint hover:bg-tg-card transition"
      >
        <Printer size={16} />
        {t.view_receipt}
      </button>

      {/* Delivered celebration */}
      {isDelivered && (
        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="font-semibold text-emerald-700">
            {lang === "uz" ? "Buyurtma yetkazildi!" : "Заказ доставлен!"}
          </p>
          <button onClick={() => nav("/")} className="btn-brand mt-1">
            {lang === "uz" ? "Bosh sahifaga" : "На главную"}
          </button>
        </div>
      )}

      {/* ── RECEIPT MODAL ─────────────────────────────────── */}
      {showReceipt && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center z-50"
          onClick={() => setShowReceipt(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-sm rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-slate-200 mb-4" />

            <div className="rounded-2xl border border-dashed border-slate-300 p-5">
              {/* Header — do'kon ma'lumoti */}
              <div className="text-center mb-4">
                <div className="mx-auto mb-2 h-11 w-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div className="text-xl font-semibold tracking-tight text-slate-900">{store?.name || "Barakali Bozor"}</div>
                {store?.address && <div className="text-xs text-slate-400 mt-1">📍 {store.address}</div>}
                {store?.phones?.[0] && <div className="text-xs text-slate-400">📱 {store.phones[0]}</div>}
              </div>

              {/* Meta */}
              <div className="border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500 space-y-1.5">
                <div className="flex justify-between">
                  <span>{t.order} №</span>
                  <span className="font-semibold text-slate-700">{order.number}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === "uz" ? "Sana" : "Дата"}</span>
                  <span>{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === "uz" ? "Holat" : "Статус"}</span>
                  <span className="font-medium text-slate-700">{t.status[order.status]}</span>
                </div>
              </div>

              {/* Mahsulotlar */}
              <div className="border-t border-dashed border-slate-200 mt-3 pt-3 space-y-3">
                {order.items.map((it) => (
                  <div key={it.id} className="flex items-start gap-2.5 text-sm">
                    {it.image_url ? (
                      <OptimizedImage src={it.image_url} className="h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">🍽</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 truncate">{loc(it, "name", lang)}</div>
                      <div className="text-xs text-slate-400 tabular-nums">
                        {qtyUnit(it.quantity, it.unit, lang)} × {money(it.price)} {t.sum}
                      </div>
                      {it.note && <div className="text-xs text-brand-dark/80 mt-0.5">💬 {it.note}</div>}
                    </div>
                    <div className="font-semibold text-right text-slate-900 tabular-nums shrink-0">
                      {money(it.price * it.quantity)} {t.sum}
                    </div>
                  </div>
                ))}
              </div>

              {/* Yig'indilar */}
              <div className="border-t border-dashed border-slate-200 mt-4 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-slate-500 tabular-nums">
                  <span>{t.items_label}</span>
                  <span>{money(order.items_total)} {t.sum}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500 tabular-nums">
                  <span>{t.delivery}</span>
                  <span>{order.delivery_fee === 0 ? t.free : `${money(order.delivery_fee)} ${t.sum}`}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t.payment}</span>
                  <span>{payLabel}</span>
                </div>
              </div>

              <div className="border-t-2 border-slate-900 mt-3 pt-3 flex justify-between items-baseline">
                <span className="font-semibold text-base">{t.total}</span>
                <span className="font-semibold text-xl tabular-nums">{money(order.total)} {t.sum}</span>
              </div>

              {/* Yetkazish manzili */}
              <div className="mt-4 text-xs text-slate-400 space-y-0.5 border-t border-dashed border-slate-200 pt-3">
                <div>📍 {order.address_line}</div>
                {order.phone && <div>📱 {order.phone}</div>}
              </div>

              <div className="mt-4 text-xs text-center text-slate-400">{t.thank_you}</div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm"
              >
                {t.close}
              </button>
              <button
                onClick={() => nav("/")}
                className="flex-1 py-3 rounded-xl bg-brand text-white font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                <ShoppingBag size={16} />
                {t.back_to_menu}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
