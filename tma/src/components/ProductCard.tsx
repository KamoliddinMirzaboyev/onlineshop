import { Minus, Plus } from "lucide-react";
import type { Product } from "../api/types";
import OptimizedImage from "./OptimizedImage";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

/**
 * 3 ustunli mahsulot kartasi — yumaloq oq fon, rasm object-contain,
 * pastki o'ngda + tugma (referens UI ga yaqin).
 */
export default function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useI18n();
  const cart = useCart();
  const qty = cart.lines[product.id]?.quantity ?? 0;

  const add = () => {
    cart.add(product);
    haptic("light");
  };
  const dec = () => {
    cart.setQty(product.id, qty - 1);
    haptic("light");
  };

  return (
    <div className="flex flex-col rounded-2xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] border border-black/[0.04] overflow-hidden">
      {/* Rasm zonasi — kvadrat emas, biroz pastroq (ingichka cho'zilmasin) */}
      <div className="relative w-full aspect-[5/4] bg-white flex items-center justify-center p-2.5">
        {product.image_url ? (
          <OptimizedImage
            src={product.image_url}
            className="max-h-full max-w-full w-full h-full object-contain"
          />
        ) : (
          <span className="text-3xl opacity-40">🛒</span>
        )}

        {qty === 0 ? (
          <button
            type="button"
            onClick={add}
            className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-[0_2px_8px_rgba(15,23,42,0.12)] border border-black/[0.06] active:scale-90 transition"
            aria-label={t.add}
          >
            <Plus size={18} strokeWidth={2.25} />
          </button>
        ) : (
          <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.12)] border border-black/[0.06] p-0.5">
            <button
              type="button"
              onClick={dec}
              className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-slate-800 active:scale-90 transition"
              aria-label="-"
            >
              <Minus size={15} strokeWidth={2.25} />
            </button>
            <span className="text-xs font-semibold tabular-nums text-slate-900 px-0.5">
              {qty}
            </span>
            <button
              type="button"
              onClick={add}
              className="h-7 w-7 shrink-0 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition"
              aria-label="+"
            >
              <Plus size={15} strokeWidth={2.25} />
            </button>
          </div>
        )}
      </div>

      <div className="px-2.5 pb-2.5 pt-0.5 flex flex-col gap-0.5">
        <p className="font-bold text-[13px] text-slate-900 leading-tight tabular-nums tracking-tight">
          {money(product.price)}
          <span className="font-medium text-[11px] text-slate-400 ml-0.5">{t.sum}</span>
        </p>
        <h3 className="text-[12px] font-medium leading-snug text-slate-800 line-clamp-2">
          {loc(product, "name", lang)}
        </h3>
        {product.unit && (
          <p className="text-[11px] text-slate-400 leading-none mt-0.5">
            1{unitLabel(product.unit, lang)}
          </p>
        )}
      </div>
    </div>
  );
}
