import {
  Bike, BarChart3, LayoutDashboard, LogOut, MapPinned, Megaphone, Menu, ReceiptText,
  Settings, ShoppingBasket, Truck, Users, Warehouse, X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../store";

import NotificationBell from "./NotificationBell";

// `roles` undefined → visible to every allowed (non-courier) admin.
// `roles` set → only those roles see the link.
const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/orders", label: "Buyurtmalar", icon: ReceiptText },
  { to: "/products", label: "Mahsulotlar", icon: ShoppingBasket },
  { to: "/warehouse", label: "Ombor", icon: Warehouse },
  { to: "/supplies", label: "Yetkazib berish", icon: Truck },
  { to: "/delivery-zone", label: "Yetkazish hududi", icon: MapPinned },
  { to: "/post", label: "Post", icon: Megaphone, roles: ["superadmin"] },
  { to: "/reports", label: "Hisobot", icon: BarChart3, roles: ["superadmin"] },
  { to: "/users", label: "Foydalanuvchilar", icon: Users, roles: ["superadmin"] },
  { to: "/couriers", label: "Xodimlar", icon: Bike, roles: ["superadmin"] },
  { to: "/settings", label: "Sozlamalar", icon: Settings, roles: ["superadmin"] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Navbar — mobile top bar + desktop header (offset past the fixed sidebar) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200 md:ml-64">
        <button className="icon-btn md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <img src="/logo-64.png" alt="" className="h-8 w-8 object-contain md:hidden" />
        <span className="font-semibold tracking-tight md:hidden">Barakali Bozor</span>
        <span className="ml-auto">
          <NotificationBell />
        </span>
      </header>

      {/* Overlay (mobile, when drawer open) */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar — static on desktop, drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-100">
          <img src="/logo-64.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-lg font-semibold tracking-tight">Barakali Bozor</span>
          <button className="icon-btn ml-auto md:hidden" onClick={() => setOpen(false)} aria-label="Yopish"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links
            .filter((l) => !l.roles || (admin && l.roles.includes(admin.role)))
            .map((l) => {
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

          <div className="flex items-center gap-3 mb-3 mt-1">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-brand/10 text-brand font-semibold uppercase">
              {admin?.username?.[0] ?? "A"}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{admin?.username}</div>
              <div className="text-xs text-slate-400 capitalize">{admin?.role}</div>
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

      <main className="md:ml-64 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
