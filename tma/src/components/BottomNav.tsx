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
      className="flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium"
    >
      {({ isActive }) => (
        <div className={`flex flex-col items-center justify-center w-16 py-1.5 rounded-2xl transition ${isActive ? "bg-brand-light/60 text-brand" : "text-slate-500"}`}>
          <Icon size={22} className="mb-0.5" />
          <span className="truncate">{label}</span>
        </div>
      )}
    </NavLink>
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-tg-bg border-t border-black/10 flex pb-[env(safe-area-inset-bottom)]">
      {item("/", t.home, House)}
      {item("/search", t.search_tab, Search)}
      {item("/orders", t.orders, History)}
      {item("/profile", t.profile, User)}
    </nav>
  );
}
