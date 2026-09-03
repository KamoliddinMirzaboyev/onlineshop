import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OptimizedImage from "../components/OptimizedImage";
import PageHeader from "../components/PageHeader";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { prewarmCheckoutLocation } from "../lib/prewarmLocation";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

export default function CartPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const cart = useCart();
  const lines = Object.values(cart.lines);

  // Savatchada mahsulot bor — checkout ehtimoli yuqori. Joylashuvni oldindan ol.
  useEffect(() => {
    if (lines.length > 0) void prewarmCheckoutLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lines.length === 0) {
    return (
      <div className="min-h-full bg-tg-bg">
        <PageHeader title={t.cart} />
        <div className="p-10 text-center text-tg-hint">
          <div className="text-5xl mb-3">🛒</div>
          {t.cart_empty}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-tg-bg pb-36">
      <PageHeader title={t.cart} subtitle={`${cart.count()} ${t.products_n}`} />

      <div className="px-4 divide-y divide-black/5">
        {lines.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-start gap-3 py-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-tg-card flex items-center justify-center overflow-hidden text-2xl">
              {product.image_url ? (
                <OptimizedImage src={product.image_url} className="h-full w-full object-cover" />
              ) : (
                "🛒"
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-tight line-clamp-1">{loc(product, "name", lang)}</h3>
                <button
                  onClick={() => {
                    cart.remove(product.id);
                    haptic("light");
                  }}
                  className="shrink-0 text-tg-hint/70 active:scale-90 transition"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <p className="text-sm text-tg-hint mt-1">
                1{product.unit ? unitLabel(product.unit, lang) : ""}
              </p>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="font-semibold text-base text-slate-900">{money(product.price * quantity)}</span>
                <div className="flex items-center gap-1 rounded-full bg-slate-100 px-1 py-1">
                  <button
                    onClick={() => cart.setQty(product.id, quantity - 1)}
                    className="h-8 w-8 flex items-center justify-center text-slate-600 active:scale-90 transition"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-[2.5rem] text-center text-sm font-medium text-slate-900">
                    {quantity} {product.unit ? unitLabel(product.unit, lang) : ""}
                  </span>
                  <button
                    onClick={() => cart.setQty(product.id, quantity + 1)}
                    className="h-8 w-8 flex items-center justify-center text-slate-600 active:scale-90 transition"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-16 inset-x-0 bg-white border-t border-black/5 flex flex-col z-20">
        <div className="flex justify-end px-4 py-2">
          <button
            onClick={() => {
              cart.clear();
              haptic("light");
            }}
            className="text-sm font-medium text-rose-500 bg-rose-50 px-4 py-1.5 rounded-full active:scale-95 transition"
          >
            {t.clear_cart}
          </button>
        </div>
        <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <p className="text-sm text-slate-500 font-medium leading-none mb-1.5">{t.products_n}</p>
            <p className="font-semibold text-xl leading-none text-slate-900">{money(cart.total())}</p>
          </div>
          <button
            onClick={() => {
              void prewarmCheckoutLocation();
              nav("/checkout");
            }}
            className="flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-[20px] px-6 py-4 active:scale-95 transition shadow-md shadow-brand/30"
          >
            {t.place_order}
            <span aria-hidden className="text-lg leading-none">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
