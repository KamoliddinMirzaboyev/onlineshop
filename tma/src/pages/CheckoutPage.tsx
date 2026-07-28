import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getCoords } from "../api/client";
import type { Restaurant } from "../api/types";
import PageHeader from "../components/PageHeader";
import { useI18n } from "../i18n";
import { formatUzPhone, money } from "../lib/format";
import { reverseGeocode } from "../lib/geocode";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useCheckoutDraft } from "../store/checkoutDraft";
import { haptic } from "../telegram";

const DEFAULT_FREE_FROM = 50_000;
const DEFAULT_PER_KM = 2_000;

/** Backend xato matnini ({"detail": "..."}) ajratib oladi. */
function errorText(e: unknown): string {
  const raw = String(e);
  const m = raw.match(/\{.*\}/s);
  if (m) {
    try {
      const d = JSON.parse(m[0]).detail;
      if (typeof d === "string") return d;
    } catch {
      /* ignore */
    }
  }
  return raw;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371.0088;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dlat = toR(lat2 - lat1);
  const dlng = toR(lng2 - lng1);
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dlng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Backend calc_delivery_fee bilan bir xil qoida. */
function estimateDeliveryFee(
  itemsTotal: number,
  distanceKm: number | null,
  freeFrom: number,
  perKm: number,
): number {
  const threshold = freeFrom > 0 ? freeFrom : DEFAULT_FREE_FROM;
  const rate = perKm > 0 ? perKm : DEFAULT_PER_KM;
  if (itemsTotal >= threshold) return 0;
  if (distanceKm == null || distanceKm <= 0) return rate;
  return Math.ceil(distanceKm) * rate;
}

export default function CheckoutPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const cart = useCart();
  const user = useAuth((s) => s.user);

  const { phone, comment, loc, address, setPhone, setComment, setLocation, reset: resetDraft } = useCheckoutDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<Restaurant | null>(null);

  // Qoralamada telefon hali bo'sh bo'lsa, profildagi raqam bilan to'ldiramiz.
  useEffect(() => {
    if (!phone && user?.phone) setPhone(formatUzPhone(user.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);

  // Yetkazib berish manzili sifatida TMA ochilishida aniqlangan joylashuv
  // jim ishlatiladi — checkoutda qayta so'ralmaydi, qo'lda tanlash yo'q.
  const fetchLocation = () =>
    getCoords().then((coords) => {
      if (!coords) return null;
      return reverseGeocode(coords.lat, coords.lng).then((a) => {
        const addr = a ?? `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
        setLocation(coords.lat, coords.lng, addr);
        return { ...coords, address: addr };
      });
    });

  useEffect(() => {
    if (!loc) fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cart.restaurantId == null) return;
    api.restaurant(cart.restaurantId).then(setStore).catch(() => setStore(null));
  }, [cart.restaurantId]);

  const lines = Object.values(cart.lines);
  const itemsTotal = cart.total();
  const freeFrom = store && store.min_order > 0 ? store.min_order : DEFAULT_FREE_FROM;
  const perKm = store && store.delivery_fee > 0 ? store.delivery_fee : DEFAULT_PER_KM;

  const deliveryFee = useMemo(() => {
    let dist: number | null = null;
    if (loc && store?.lat != null && store?.lng != null) {
      dist = haversineKm(store.lat, store.lng, loc.lat, loc.lng);
    }
    return estimateDeliveryFee(itemsTotal, dist, freeFrom, perKm);
  }, [itemsTotal, loc, store, freeFrom, perKm]);

  const grandTotal = itemsTotal + deliveryFee;

  const submit = async () => {
    if (cart.restaurantId == null) {
      setError(lang === "uz" ? "Savatcha bo'sh" : "Корзина пуста");
      return;
    }
    if (phone.replace(/\D/g, "").length < 12) {
      setError(lang === "uz" ? "Telefon raqamini to'liq kiriting" : "Введите номер телефона полностью");
      return;
    }
    let deliveryLoc = loc;
    if (!deliveryLoc) {
      deliveryLoc = await fetchLocation();
    }
    if (!deliveryLoc) {
      setError(
        lang === "uz"
          ? "Joylashuvni aniqlab bo'lmadi. Telegram sozlamalaridan geolokatsiyaga ruxsat bering va qayta urinib ko'ring"
          : "Не удалось определить местоположение. Разрешите геолокацию в настройках Telegram и попробуйте снова"
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.placeOrder({
        restaurant_id: cart.restaurantId,
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        address_line: address || undefined,
        lat: deliveryLoc.lat,
        lng: deliveryLoc.lng,
        phone,
        comment,
        payment_method: "cash",
      });
      haptic("medium");
      cart.clear();
      resetDraft();
      nav(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (e) {
      setError(errorText(e));
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return <div className="p-10 text-center text-tg-hint">{t.cart_empty}</div>;
  }

  return (
    <div className="min-h-full bg-tg-bg pb-8">
      <PageHeader title={t.checkout} back />

      <div className="p-4 space-y-5 bg-white">
        <div className="space-y-2">
          <label className="text-[13px] text-slate-400 font-medium px-1">{t.phone}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatUzPhone(e.target.value))}
            inputMode="tel"
            placeholder="+998 88 888 88 88"
            className="w-full rounded-[16px] bg-[#F4F5F7] text-[16px] text-slate-900 font-medium px-4 py-4 outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] text-slate-400 font-medium px-1">{t.comment}</label>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-[16px] bg-[#F4F5F7] text-[16px] text-slate-900 font-medium px-4 py-4 outline-none"
          />
        </div>

        <div className="mt-6 space-y-2 px-1">
          <div className="flex justify-between text-[15px] text-slate-600">
            <span>{lang === "uz" ? "Mahsulotlar" : "Товары"}</span>
            <span>{money(itemsTotal)} {t.sum}</span>
          </div>
          <div className="flex justify-between text-[15px] text-slate-600">
            <span>{lang === "uz" ? "Yetkazish" : "Доставка"}</span>
            <span>
              {deliveryFee === 0
                ? t.free
                : `${money(deliveryFee)} ${t.sum}`}
            </span>
          </div>
          {itemsTotal < freeFrom && (
            <p className="text-[12px] text-slate-400">
              {lang === "uz"
                ? `${money(freeFrom)} so‘mdan bepul yetkazish · ${money(perKm)} so‘m/km`
                : `Бесплатная доставка от ${money(freeFrom)} сум · ${money(perKm)} сум/км`}
            </p>
          )}
          <div className="flex justify-between items-center font-extrabold text-[20px] text-slate-900 pt-2">
            <span>{lang === "uz" ? "Jami" : "Итого"}</span>
            <span>{money(grandTotal)} {t.sum}</span>
          </div>
        </div>

        {error && <p className="text-rose-500 text-sm font-medium px-1 mb-2">{error}</p>}

        <button onClick={submit} disabled={submitting} className="w-full bg-brand text-white font-bold text-[17px] py-4 rounded-[16px] active:scale-[0.98] transition disabled:opacity-60 shadow-lg shadow-brand/30">
          {submitting ? "…" : (lang === "uz" ? "Buyurtma berish" : "Заказать")}
        </button>
      </div>
    </div>
  );
}
