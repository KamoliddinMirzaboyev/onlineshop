import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getCoords } from "./api/client";
import BottomNav from "./components/BottomNav";
import Splash from "./components/Splash";
import { useTelegramBackButton } from "./hooks/useTelegramBackButton";
import { prefetchStore } from "./hooks/useStore";
import CartPage from "./pages/CartPage";
import CategoryPage from "./pages/CategoryPage";
import CheckoutPage from "./pages/CheckoutPage";
import HomePage from "./pages/HomePage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import { useAuth } from "./store/auth";

function AppRoutes() {
  // Nested sahifada Telegram/Android Back → SPA ichida orqaga (TMA yopilmaydi).
  useTelegramBackButton();

  return (
    <div className="min-h-full pb-20">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:id" element={<CategoryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const { ready, login } = useAuth();

  useEffect(() => {
    login();
    // TMA ochilishi bilan darhol joylashuv + katalog — Home skeleton qisqaroq.
    // Natija keshlanadi, sahifalar qayta so'ramaydi.
    void getCoords().then(() => prefetchStore());
  }, [login]);

  return (
    <>
      <AnimatePresence>{!ready && <Splash />}</AnimatePresence>
      {ready && <AppRoutes />}
    </>
  );
}
