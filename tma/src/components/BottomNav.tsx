import { History, House, Search, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n";

export default function BottomNav() {
  const { t } = useI18n();

  const item = (to: string, label: string, Icon: LucideIcon) => (
    <NavLink
      to={to}
      end={to === "/"}
      className="flex flex-1 flex-col items-center justify-center py-1.5 min-w-0"
    >
      {({ isActive }) => (
        <div className="flex flex-col items-center gap-0.5 max-w-full px-1">
          <span
            className={
              isActive
                ? "grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-md shadow-brand/30"
                : "grid h-10 w-10 place-items-center rounded-2xl text-slate-400"
            }
          >
            <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} />
          </span>
          <span
            className={
              isActive
                ? "truncate text-xs font-medium leading-tight text-brand"
                : "truncate text-xs font-normal leading-tight text-slate-400"
            }
          >
            {label}
          </span>
        </div>
      )}
    </NavLink>
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-black/10 bg-tg-bg pb-[env(safe-area-inset-bottom)]">
      {item("/", t.home, House)}
      {item("/search", t.search_tab, Search)}
      {item("/orders", t.orders, History)}
      {item("/profile", t.profile, User)}
    </nav>
  );
}
