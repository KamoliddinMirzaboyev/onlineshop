import { AnimatePresence } from "framer-motion";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getCoords } from "./api/client";
import BottomNav from "./components/BottomNav";
import Splash from "./components/Splash";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { prefetchStore } from "./hooks/useStore";
import HomePage from "./pages/HomePage";
import { useAuth } from "./store/auth";
import { useI18n } from "./i18n";

// Home'dan tashqari sahifalar — alohida chunk (leaflet/checkout boshlang'ich
// bundle'ni shishirmasin). Home landing bo'lgani uchun eager qoladi.
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const error = useAuth((s) => s.error);
  const login = useAuth((s) => s.login);
  const { lang } = useI18n();

  if (!user) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-tg-hint text-sm leading-relaxed max-w-sm">
          {error ||
            (lang === "uz"
              ? "Kirish talab qilinadi"
              : "Требуется вход")}
        </p>
        <button
          type="button"
          onClick={() => void login()}
          className="bg-brand text-white font-medium px-6 py-3 rounded-2xl active:scale-95 transition"
        >
          {lang === "uz" ? "Qayta urinish" : "Повторить"}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  // Nested sahifada Telegram/Android Back → SPA ichida orqaga (TMA yopilmaydi).
  useTelegramBackButton();

  return (
    <div className="min-h-full pb-20">
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:id" element={<CategoryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/checkout"
          element={
            <AuthGate>
              <CheckoutPage />
            </AuthGate>
          }
        />
        <Route
          path="/orders"
          element={
            <AuthGate>
              <OrdersPage />
            </AuthGate>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <AuthGate>
              <OrderDetailPage />
            </AuthGate>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGate>
              <ProfilePage />
            </AuthGate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const { ready, login, error, user } = useAuth();

  useEffect(() => {
    void login();
    // Do'kon va joylashuv parallel — joylashuv sekin bo'lsa ham katalog ochiladi.
    void prefetchStore();
    void getCoords();
  }, [login]);

  // Auth muvaffaqiyatsiz — splash o'rniga xato + retry (katalog ochilmaydi agar kerak).
  // Katalog public, lekin user yo'q bo'lsa ham Home ochilishi mumkin (faqat error banner).
  const showApp = ready;

  return (
    <>
      <AnimatePresence>{!ready && <Splash />}</AnimatePresence>
      {showApp && (
        <>
          {error && !user && (
            <div className="sticky top-0 z-50 bg-rose-50 border-b border-rose-100 px-4 py-2.5 flex items-center justify-between gap-3">
              <p className="text-xs text-rose-700 leading-snug flex-1">{error}</p>
              <button
                type="button"
                onClick={() => void login()}
                className="shrink-0 text-xs font-semibold text-brand"
              >
                Retry
              </button>
            </div>
          )}
          <AppRoutes />
        </>
      )}
    </>
  );
}
