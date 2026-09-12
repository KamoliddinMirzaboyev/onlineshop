import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { hasToken, setToken } from "./api";
import { ConfirmHost } from "./components/Confirm";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import { useAuth } from "./store";

// Og'ir sahifalar alohida chunk: Hisobotlar recharts + xlsx-js-style
// olib keladi va boshlang'ich bundle'ni 1.9 MB qilib qo'yardi.
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const PostPage = lazy(() => import("./pages/PostPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const StoresPage = lazy(() => import("./pages/StoresPage"));
const WarehousePage = lazy(() => import("./pages/WarehousePage"));

function Protected({ children }: { children: React.ReactNode }) {
  const { business, loadMe } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasToken()) {
      setChecked(true);
      return;
    }
    loadMe().finally(() => setChecked(true));
  }, [loadMe]);

  if (!checked) return <div className="p-10 text-gray-400">…</div>;

  // Token bor-u, loadMe muvaffaqiyatsiz bo'lsa (business null qoldi) — token
  // eskirgan/yaroqsiz. Tozalab, login sahifasiga qaytaramiz.
  if (!business) {
    if (hasToken()) setToken(null);
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

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
      <Suspense fallback={<div className="p-10 text-center text-slate-400">Yuklanmoqda…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
        <Route path="/stores" element={<Protected><StoresPage /></Protected>} />
        <Route path="/products" element={<Protected><ProductsPage /></Protected>} />
        <Route path="/warehouse" element={<Protected><WarehousePage /></Protected>} />
        <Route path="/orders" element={<Protected><OrdersPage /></Protected>} />
        <Route path="/customers" element={<Protected><CustomersPage /></Protected>} />
        <Route path="/staff" element={<Protected><StaffPage /></Protected>} />
        <Route path="/post" element={<Protected><PostPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
