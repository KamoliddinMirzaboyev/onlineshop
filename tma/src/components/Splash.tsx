import { ShoppingBasket } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Boot splash. Shown while Telegram auth resolves. Parent unmounts it (inside
 * <AnimatePresence>) once ready; the exit animation fades the overlay away.
 */
export default function Splash() {
  return (
    <motion.div
      key="splash"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#22C55E] to-brand"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
    >
      <div className="relative flex items-center justify-center">
        {/* Pulsing rings */}
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-3xl border-2 border-white/40"
            style={{ width: 96, height: 96 }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{
              duration: 1.6,
              ease: "easeOut",
              repeat: Infinity,
              delay: i * 0.8,
            }}
          />
        ))}

        {/* Logo */}
        <motion.div
          className="h-24 w-24 rounded-3xl bg-white flex items-center justify-center shadow-2xl"
          initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <motion.div
            animate={{ y: [-2, 2, -2] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ShoppingBasket size={46} className="text-brand" />
          </motion.div>
        </motion.div>
      </div>

      <motion.h1
        className="mt-6 text-xl font-semibold tracking-tight text-white"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        Barakali Bozor
      </motion.h1>
      <motion.p
        className="text-white/80 text-sm mt-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        Yetkazib berish
      </motion.p>

      {/* Loading dots */}
      <div className="absolute bottom-16 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-white"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
