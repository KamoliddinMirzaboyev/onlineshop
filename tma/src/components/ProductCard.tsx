import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import type { Product } from "../api/types";
import OptimizedImage from "./OptimizedImage";
import { loc, useI18n } from "../i18n";
import { money, unitLabel } from "../lib/format";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

const spring = { type: "spring" as const, stiffness: 420, damping: 28, mass: 0.7 };

/**
 * 3 ustunli mahsulot kartasi — bir xil balandlik, + bosilganda yumshoq expand.
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
    <div className="flex h-full flex-col rounded-2xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] border border-slate-200/80 overflow-hidden">
      <div className="relative w-full aspect-square shrink-0 bg-[#F3F4F6] overflow-hidden">
        {product.image_url ? (
          <OptimizedImage
            src={product.image_url}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-3xl opacity-40">
            🛒
          </span>
        )}

        {/* + / stepper — o'ng past, expand animatsiya */}
        <div className="absolute bottom-1.5 right-1.5 left-1.5 flex justify-end pointer-events-none">
          <AnimatePresence mode="popLayout" initial={false}>
            {qty === 0 ? (
              <motion.button
                key="add"
                type="button"
                onClick={add}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={spring}
                whileTap={{ scale: 0.88 }}
                className="pointer-events-auto h-8 w-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-[0_2px_10px_rgba(15,23,42,0.14)] border border-black/[0.06]"
                aria-label={t.add}
              >
                <Plus size={18} strokeWidth={2.25} />
              </motion.button>
            ) : (
              <motion.div
                key="stepper"
                initial={{ width: 32, opacity: 0.85, scale: 0.92 }}
                animate={{ width: "100%", opacity: 1, scale: 1 }}
                exit={{ width: 32, opacity: 0, scale: 0.9 }}
                transition={spring}
                className="pointer-events-auto flex h-8 max-w-full items-center justify-between overflow-hidden rounded-full bg-white shadow-[0_2px_10px_rgba(15,23,42,0.14)] border border-black/[0.06] p-0.5 origin-right"
              >
                <motion.button
                  type="button"
                  onClick={dec}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring, delay: 0.04 }}
                  whileTap={{ scale: 0.88 }}
                  className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-slate-800"
                  aria-label="-"
                >
                  <Minus size={15} strokeWidth={2.25} />
                </motion.button>

                <motion.span
                  key={qty}
                  initial={{ scale: 0.7, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                  className="text-xs font-semibold tabular-nums text-slate-900 px-0.5 min-w-[1.25rem] text-center"
                >
                  {qty}
                </motion.span>

                <motion.button
                  type="button"
                  onClick={add}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring, delay: 0.05 }}
                  whileTap={{ scale: 0.88 }}
                  className="h-7 w-7 shrink-0 rounded-full bg-brand text-white flex items-center justify-center"
                  aria-label="+"
                >
                  <Plus size={15} strokeWidth={2.25} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex min-h-[72px] flex-1 flex-col gap-0.5 px-2.5 pb-2.5 pt-1.5">
        <p className="font-bold text-[13px] text-slate-900 leading-tight tabular-nums tracking-tight">
          {money(product.price)}
          <span className="font-medium text-[11px] text-slate-400 ml-0.5">{t.sum}</span>
        </p>
        <h3 className="text-[12px] font-medium leading-snug text-slate-800 line-clamp-2 min-h-[2rem]">
          {loc(product, "name", lang)}
        </h3>
        <p className="mt-auto text-[11px] text-slate-400 leading-none">
          {product.unit ? `1${unitLabel(product.unit, lang)}` : "\u00a0"}
        </p>
      </div>
    </div>
  );
}
