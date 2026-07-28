import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBasket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { money } from "../lib/format";
import { useCart } from "../store/cart";
import { useI18n } from "../i18n";

/** Compact floating cart button (bottom-right) shown on every browse screen. */
export default function CartPill() {
  const nav = useNavigate();
  const cart = useCart();
  const { t } = useI18n();
  const count = cart.count();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          key="cart-pill"
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: 20 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => nav("/cart")}
          className="fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-brand pl-3 pr-4 py-2.5 text-white shadow-lg shadow-brand/30"
        >
          <span className="relative shrink-0">
            <ShoppingBasket size={20} />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-medium text-brand">
              {count}
            </span>
          </span>
          <span className="font-medium text-sm whitespace-nowrap">
            {money(cart.total())} {t.sum}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
