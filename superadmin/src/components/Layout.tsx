import {
  Building2, LayoutDashboard, LogOut, Megaphone, Menu, Settings, Store, Users, X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../store";

const links = [
  { to: "/", label: "Umumiy", icon: LayoutDashboard, end: true },
  { to: "/businesses", label: "Tadbirkorlar", icon: Store },
  { to: "/stores", label: "Do'konlar", icon: Building2 },
  { to: "/customers", label: "Mijozlar", icon: Users },
  { to: "/announcements", label: "E'lonlar", icon: Megaphone },
  { to: "/settings", label: "Sozlamalar", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200 md:ml-64">
        <button className="icon-btn md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <img src="/logo-64.png" alt="" className="h-8 w-8 object-contain md:hidden" />
        <span className="font-semibold tracking-tight md:hidden">Super Admin</span>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-100">
          <img src="/logo-64.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-lg font-semibold tracking-tight">Super Admin</span>
          <button className="icon-btn ml-auto md:hidden" onClick={() => setOpen(false)} aria-label="Yopish"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-brand text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={18} />
                {l.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-brand/10 text-brand font-semibold uppercase">
              {admin?.username?.[0] ?? "A"}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{admin?.username}</div>
              <div className="text-xs text-slate-400 truncate">Platforma admini</div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              nav("/login");
            }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition"
          >
            <LogOut size={16} /> Chiqish
          </button>
        </div>
      </aside>

      <main className="md:ml-64 p-4 md:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
