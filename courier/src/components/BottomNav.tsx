import { Clock, Home, Package, User } from "lucide-react";
import { motion } from "motion/react";
import { NavLink } from "react-router-dom";
import { spring } from "../lib/motion";

const TABS = [
  { to: "/", label: "Asosiy", icon: Home, end: true },
  { to: "/orders", label: "Buyurtma", icon: Package, end: false },
  { to: "/history", label: "Tarix", icon: Clock, end: false },
  { to: "/profile", label: "Profil", icon: User, end: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute -top-px h-0.5 w-8 rounded-full bg-brand"
                    transition={spring}
                  />
                )}
                <motion.span
                  animate={{
                    scale: isActive ? 1.12 : 1,
                    y: isActive ? -1 : 0,
                  }}
                  transition={spring}
                  className={isActive ? "text-brand" : "text-slate-400"}
                >
                  <Icon size={20} />
                </motion.span>
                <span className={isActive ? "text-brand" : "text-slate-400"}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
