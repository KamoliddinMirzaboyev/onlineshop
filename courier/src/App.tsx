import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { hasToken } from "./api";
import AnimatedPage from "./components/AnimatedPage";
import Layout from "./components/Layout";
import Splash from "./components/Splash";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import { useAuth } from "./store";
import { startLocationTracking, stopLocationTracking } from "./location";

function Protected({ children }: { children: React.ReactNode }) {
  const { loadMe } = useAuth();
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);

  const verify = () => {
    if (!hasToken()) {
      setChecked(true);
      return;
    }
    setFailed(false);
    loadMe()
      .then(() => setFailed(false))
      .catch(() => {
        // 401 is already handled in api.ts (token cleared + redirect to /login).
        if (hasToken()) setFailed(true);
      })
      .finally(() => setChecked(true));
  };

  useEffect(verify, [loadMe]);

  // Hooks must not be after early returns (React #310).
  const ready = checked && hasToken() && !failed;
  useEffect(() => {
    if (!ready) return;
    startLocationTracking();
    return () => stopLocationTracking();
  }, [ready]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Yuklanmoqda…
      </div>
    );
  }
  if (!hasToken()) return <Navigate to="/login" replace />;
  if (failed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400 p-4 text-center">
        <p>Ulanishda xatolik. Internetni tekshiring.</p>
        <button
          onClick={verify}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium active:scale-95 transition"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  // Boot splash: shown once on cold start, minimum on-screen time so the brand
  // animation reads even on a fast connection. Session verify runs behind it.
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence>{booting && <Splash />}</AnimatePresence>

      <Routes>
        <Route path="/login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route
          path="/orders/:id"
          element={
            <Protected>
              <AnimatedPage><OrderDetailPage /></AnimatedPage>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
