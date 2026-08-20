import { Map as MapIcon, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  cacheAddressLabel,
  clearAddressLabel,
  getCoords,
  peekAddressLabel,
} from "../api/client";
import type { Restaurant } from "../api/types";
import MapPicker from "../components/MapPicker";
import PageHeader from "../components/PageHeader";
import { useI18n } from "../i18n";
import { formatUzPhone, money } from "../lib/format";
import { reverseGeocodeParts } from "../lib/geocode";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { isAddressComplete, useCheckoutDraft } from "../store/checkoutDraft";
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

  const {
    phone,
    comment,
    loc,
    addressLine,
    locating,
    setPhone,
    setComment,
    setLocation,
    setAddressLine,
    setLocating,
    reset: resetDraft,
  } = useCheckoutDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<Restaurant | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (!phone && user?.phone) setPhone(formatUzPhone(user.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);

  /**
   * Manzil + GPS.
   * force/highAccuracy: har doim yangi GPS (kesh emas).
   * overwriteText: true — geocode matnni yozadi; false — dirty matn saqlanadi.
   */
  const fetchLocation = async (opts?: { force?: boolean; overwriteText?: boolean }) => {
    const force = opts?.force !== false;
    const overwriteText = !!opts?.overwriteText;
    if (useCheckoutDraft.getState().locating) return null;
    setLocating(true);
    try {
      if (!force) {
        const cachedLabel = peekAddressLabel();
        const st = useCheckoutDraft.getState();
        if (cachedLabel && !st.addressLine) {
          setAddressLine(cachedLabel, false);
        }
      }

      const coords = await getCoords({ force, highAccuracy: true });
      if (!coords) return null;
      setLocation(coords.lat, coords.lng, coords.accuracyM);

      const st = useCheckoutDraft.getState();
      // Foydalanuvchi tahrirlagan matnni geocode o'chirmasin.
      if (!overwriteText && st.addressDirty && st.addressLine.trim().length >= 4) {
        return coords;
      }

      const geo = await reverseGeocodeParts(coords.lat, coords.lng);
      // Geocode tugaguncha user yozgan bo'lishi mumkin — qayta tekshir.
      const after = useCheckoutDraft.getState();
      if (!overwriteText && after.addressDirty && after.addressLine.trim().length >= 4) {
        return coords;
      }
      const line =
        geo?.label ||
        `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      useCheckoutDraft.setState({
        addressLine: line,
        addressDirty: overwriteText ? false : after.addressDirty,
      });
      cacheAddressLabel(line);
      return coords;
    } finally {
      setLocating(false);
    }
  };

  /** Xaritadan qo'lda tanlangan joy — GPS o'rniga shu koordinata ishlatiladi. */
  const applyPickedLocation = async (lat: number, lng: number) => {
    setShowMapPicker(false);
    setLocation(lat, lng, undefined);
    setLocating(true);
    try {
      const geo = await reverseGeocodeParts(lat, lng);
      const line = geo?.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      useCheckoutDraft.setState({ addressLine: line, addressDirty: false });
      cacheAddressLabel(line);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    // Checkout ochilishi: darhol yangi GPS (kesh emas).
    const cached = peekAddressLabel();
    if (cached && !addressLine.trim()) setAddressLine(cached, false);
    void fetchLocation({ force: true, overwriteText: true });
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

    // Buyurtma: FAQAT hozir olingan yuqori aniqlikdagi GPS; matn (dirty) saqlanadi.
    setError(null);
    const coords = await fetchLocation({ force: true, overwriteText: false });
    const line = useCheckoutDraft.getState().addressLine.trim() || addressLine.trim();

    if (!coords) {
      setError(
        lang === "uz"
          ? "Aniq joylashuv olinmadi. GPS ni yoqing va «Qayta aniqlash» ni bosing."
          : "Точное местоположение не получено. Включите GPS и нажмите «Определить снова».",
      );
      return;
    }
    const deliveryLoc = coords;

    if (!isAddressComplete(line)) {
      setError(t.address_required);
      return;
    }

    setSubmitting(true);
    try {
      const order = await api.placeOrder({
        restaurant_id: cart.restaurantId,
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
        })),
        address_line: line,
        lat: deliveryLoc.lat,
        lng: deliveryLoc.lng,
        phone,
        comment: comment.trim() || undefined,
        payment_method: "cash",
      });
      haptic("medium");
      clearAddressLabel();
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
          <label className="text-sm text-slate-400 font-medium px-1">{t.phone}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatUzPhone(e.target.value))}
            inputMode="tel"
            placeholder="+998 88 888 88 88"
            className="w-full rounded-[16px] bg-[#F4F5F7] text-base text-slate-900 font-normal px-4 py-4 outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>

        {/* Manzil: GPS avto + matn tahrirlash (uy raqami aniq bo'lsin) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-sm text-slate-400 font-medium">{t.address}</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={locating}
                onClick={() => setShowMapPicker(true)}
                title={t.address_pick_map}
                className="p-1 text-brand disabled:opacity-50"
              >
                <MapIcon size={16} />
              </button>
              <button
                type="button"
                disabled={locating}
                onClick={() => void fetchLocation({ force: true, overwriteText: true })}
                className="text-xs font-medium text-brand disabled:opacity-50"
              >
                {locating ? t.address_locating : t.address_refresh}
              </button>
            </div>
          </div>

          <div className="rounded-[16px] bg-[#F4F5F7] px-4 py-3">
            {locating && !addressLine ? (
              <p className="text-base text-slate-400 animate-pulse py-1">{t.address_locating}</p>
            ) : (
              <div className="flex gap-3 items-start">
                <MapPin size={20} className="text-brand shrink-0 mt-2.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400 mb-1">
                    {loc
                      ? `${t.address_auto} · ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`
                      : t.address_auto}
                  </p>
                  <textarea
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value, true)}
                    rows={2}
                    placeholder={t.address_ph}
                    className="w-full resize-none bg-transparent text-base text-slate-900 font-medium leading-snug outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                  {loc?.accuracyM != null && (
                    <p
                      className={`text-[11px] mt-1.5 font-medium ${
                        loc.accuracyM <= 25
                          ? "text-emerald-600"
                          : loc.accuracyM <= 50
                            ? "text-amber-600"
                            : "text-rose-500"
                      }`}
                    >
                      {loc.accuracyM <= 25
                        ? `✓ ${t.address_accuracy_good} (±${Math.round(loc.accuracyM)} m)`
                        : loc.accuracyM <= 50
                          ? `~ ${t.address_accuracy_ok} (±${Math.round(loc.accuracyM)} m)`
                          : `! ${t.address_accuracy_weak} (±${Math.round(loc.accuracyM)} m)`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-amber-700/80 px-1 leading-snug">
            {t.address_confirm}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-400 font-medium px-1">{t.comment}</label>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={lang === "uz" ? "Buyurtmaga izoh (ixtiyoriy)" : "Комментарий к заказу"}
            className="w-full rounded-[16px] bg-[#F4F5F7] text-base text-slate-900 font-normal px-4 py-4 outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>

        <div className="mt-2 space-y-2 px-1">
          <div className="flex justify-between text-sm text-slate-600">
            <span>{lang === "uz" ? "Mahsulotlar" : "Товары"}</span>
            <span>{money(itemsTotal)} {t.sum}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>{lang === "uz" ? "Yetkazish" : "Доставка"}</span>
            <span>
              {deliveryFee === 0
                ? t.free
                : `${money(deliveryFee)} ${t.sum}`}
            </span>
          </div>
          {itemsTotal < freeFrom && (
            <p className="text-xs text-slate-400">
              {lang === "uz"
                ? `${money(freeFrom)} so‘mdan bepul yetkazish · ${money(perKm)} so‘m/km`
                : `Бесплатная доставка от ${money(freeFrom)} сум · ${money(perKm)} сум/км`}
            </p>
          )}
          <div className="flex justify-between items-center font-semibold text-lg text-slate-900 pt-2">
            <span>{lang === "uz" ? "Jami" : "Итого"}</span>
            <span>{money(grandTotal)} {t.sum}</span>
          </div>
        </div>

        {error && <p className="text-rose-500 text-sm font-medium px-1 mb-2">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || locating}
          className="w-full bg-brand text-white font-medium text-base py-4 rounded-[16px] active:scale-[0.98] transition disabled:opacity-60 shadow-lg shadow-brand/30"
        >
          {submitting ? "…" : (lang === "uz" ? "Buyurtma berish" : "Заказать")}
        </button>
      </div>

      {showMapPicker && (
        <MapPicker
          initialLat={loc?.lat}
          initialLng={loc?.lng}
          onConfirm={(lat, lng) => void applyPickedLocation(lat, lng)}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
}
