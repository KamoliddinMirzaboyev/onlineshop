import { ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { hasToken, setToken } from "./api";
import { ConfirmHost } from "./components/Confirm";
import Layout from "./components/Layout";
import CouriersPage from "./pages/CouriersPage";
import DashboardPage from "./pages/DashboardPage";
import DeliveryZonePage from "./pages/DeliveryZonePage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import PostPage from "./pages/PostPage";
import ProductsPage from "./pages/ProductsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import SuppliesPage from "./pages/SuppliesPage";
import UsersPage from "./pages/UsersPage";
import WarehousePage from "./pages/WarehousePage";
import { enablePush } from "./push";
import { useAuth } from "./store";
// Delete uchun shunchaki qo'shilgan comment
function CourierBlocked() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="card p-8 w-full max-w-sm text-center space-y-4">
        <span className="grid place-items-center h-14 w-14 mx-auto rounded-2xl bg-rose-50 text-rose-600">
          <ShieldX size={28} />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Bu panel sizga ruxsat etilmagan</h1>
          <p className="text-sm text-slate-500 mt-1">Kuryerlar uchun alohida ilova mavjud.</p>
        </div>
        <button
          className="btn-ghost mx-auto"
          onClick={() => {
            logout();
            nav("/login");
          }}
        >
          Chiqish
        </button>
      </div>
    </div>
  );
}

function Protected({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { admin, loadMe } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasToken()) {
      setChecked(true);
      return;
    }
    loadMe().finally(() => setChecked(true));
  }, [loadMe]);

  // Login bo'lgach darhol bildirishnoma ruxsatini so'rash + push subscribe.
  // Sozlamalarda alohida yoqish yo'q — doim yoniq.
  useEffect(() => {
    if (!admin || admin.role === "courier") return;
    void enablePush().catch(() => {
      // ruxsat rad etilsa yoki SW yo'q — jim; keyingi sessiya qayta urinib ko'radi
    });
  }, [admin]);

  if (!checked) return <div className="p-10 text-gray-400">…</div>;

  // Gate on `admin` being loaded. If a token is present but loadMe failed
  // (admin stayed null), the token is stale/invalid — clear it and bounce to login.
  if (!admin) {
    if (hasToken()) setToken(null);
    return <Navigate to="/login" replace />;
  }

  // Couriers have their own app — they are not allowed in here at all.
  if (admin.role === "courier") return <CourierBlocked />;

  // Route-level RBAC: managers can't reach superadmin-only pages.
  if (roles && !roles.includes(admin.role)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

const SUPERADMIN = ["superadmin"];

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { borderRadius: "12px" } }}
      />
      <ConfirmHost />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/orders" element={<Protected><OrdersPage /></Protected>} />
      <Route path="/products" element={<Protected><ProductsPage /></Protected>} />
      <Route path="/warehouse" element={<Protected><WarehousePage /></Protected>} />
      <Route path="/supplies" element={<Protected><SuppliesPage /></Protected>} />
      <Route path="/delivery-zone" element={<Protected><DeliveryZonePage /></Protected>} />
      <Route path="/post" element={<Protected roles={SUPERADMIN}><PostPage /></Protected>} />
      <Route path="/reports" element={<Protected roles={SUPERADMIN}><ReportsPage /></Protected>} />
      <Route path="/users" element={<Protected roles={SUPERADMIN}><UsersPage /></Protected>} />
      <Route path="/couriers" element={<Protected roles={SUPERADMIN}><CouriersPage /></Protected>} />
      <Route path="/settings" element={<Protected roles={SUPERADMIN}><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
