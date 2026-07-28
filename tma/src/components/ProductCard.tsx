import { Minus, Plus } from "lucide-react";
import type { Product } from "../api/types";
import OptimizedImage from "./OptimizedImage";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

/** 3 ustunli grid uchun ixcham mahsulot kartasi. */
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
    <div className="card flex flex-col border border-black/5 overflow-hidden">
      <div className="relative aspect-square bg-tg-card flex items-center justify-center text-2xl">
        {product.image_url ? (
          <OptimizedImage src={product.image_url} className="h-full w-full object-cover" />
        ) : (
          "🛒"
        )}

        {/* Qo'shish / miqdor — rasm pastida, 3 ustunga sig'adigan */}
        <div className="absolute inset-x-1 bottom-1 flex justify-center">
          {qty === 0 ? (
            <button
              type="button"
              onClick={add}
              className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center shadow-md shadow-brand/30 active:scale-90 transition"
              aria-label={t.add}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="flex items-center gap-0.5 rounded-full bg-white/95 backdrop-blur-sm shadow-md shadow-black/10 p-0.5 max-w-full">
              <button
                type="button"
                onClick={dec}
                className="h-7 w-7 shrink-0 rounded-full text-slate-700 flex items-center justify-center active:scale-90 transition"
                aria-label="-"
              >
                <Minus size={14} strokeWidth={2.5} />
              </button>
              <span className="min-w-[1.25rem] px-0.5 text-center text-[11px] font-semibold text-slate-900 tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                onClick={add}
                className="h-7 w-7 shrink-0 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition"
                aria-label="+"
              >
                <Plus size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-1.5 pt-1.5 pb-2 flex flex-col gap-0.5 min-h-[3.25rem]">
        <span className="font-semibold text-[11px] text-slate-900 leading-tight tabular-nums">
          {money(product.price)}
          <span className="font-normal text-tg-hint"> {t.sum}</span>
        </span>
        <h3 className="text-[11px] leading-snug text-slate-800 line-clamp-2">
          {loc(product, "name", lang)}
        </h3>
        {product.unit && (
          <p className="text-[10px] text-tg-hint leading-none">
            1{unitLabel(product.unit, lang)}
          </p>
        )}
      </div>
    </div>
  );
}
