import {
  BarChart3, LayoutDashboard, LogOut, Megaphone, Menu, Package, ReceiptText, Settings, Store, Users, UtensilsCrossed, Warehouse, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, useStore } from "../store";
import BottomNav from "./BottomNav";

const links = [
  { to: "/", label: "Umumiy", icon: LayoutDashboard, end: true },
  { to: "/reports", label: "Hisobotlar", icon: BarChart3 },
  { to: "/stores", label: "Do'konlar", icon: Store },
  { to: "/products", label: "Mahsulotlar", icon: Package },
  { to: "/warehouse", label: "Ombor", icon: Warehouse },
  { to: "/orders", label: "Buyurtmalar", icon: ReceiptText },
  { to: "/customers", label: "Mijozlar", icon: Users },
  { to: "/staff", label: "Xodimlar", icon: UtensilsCrossed },
  { to: "/post", label: "Post", icon: Megaphone },
  { to: "/settings", label: "Sozlamalar", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { business, logout } = useAuth();
  const { selectedStoreId, setSelectedStore, stores, loadStores } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  // Do'konlar ro'yxati — header'dagi switcher uchun. Backend hali tayyor
  // bo'lmasligi mumkin (404), shu holda xato bosib o'tiladi, ilova ishlayveradi.
  useEffect(() => {
    loadStores().catch(() => {});
    // faqat bir marta — mount'da
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200 md:ml-64">
        <button className="icon-btn md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <img src="/logo-64.png" alt="" className="h-8 w-8 object-contain md:hidden" />
        <span className="font-semibold tracking-tight md:hidden">Tadbirkor</span>
        <div className="ml-auto">
          {stores.length > 0 && (
            <select
              className="input py-1.5 max-w-[200px]"
              value={selectedStoreId ?? ""}
              onChange={(e) => setSelectedStore(e.target.value === "all" ? "all" : Number(e.target.value))}
              aria-label="Do'kon tanlash"
            >
              {stores.length > 1 && <option value="all">Barcha do'konlar</option>}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
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
          <span className="text-lg font-semibold tracking-tight">Tadbirkor</span>
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
              {business?.name?.[0] ?? "T"}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{business?.name}</div>
              <div className="text-xs text-slate-400 truncate">{business?.username}</div>
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

      <main className="md:ml-64 p-4 pb-24 md:p-8 overflow-x-hidden">{children}</main>

      <BottomNav onMore={() => setOpen(true)} />
    </div>
  );
}
