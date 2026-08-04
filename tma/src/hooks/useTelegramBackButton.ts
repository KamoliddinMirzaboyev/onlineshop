import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { goBack, isNestedPath } from "../lib/navBack";
import { getWebApp } from "../telegram";

/**
 * Telegram native BackButton + Android tizim "orqaga":
 * - nested sahifada BackButton ko'rinadi → bosilganda SPA ichida orqaga
 * - ildiz (tab) sahifada yashirin → tizim orqaga Mini App ni yopadi (Telegram default)
 *
 * Muhim: BackButton visible bo'lsa, Android system back ham shu handler'ni chaqiradi
 * va Mini App yopilmaydi.
 */
export function useTelegramBackButton(): void {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const btn = getWebApp()?.BackButton;
    if (!btn) return;

    const nested = isNestedPath(pathname);
    const onBack = () => {
      goBack(navigate, pathname);
    };

    if (nested) {
      btn.show();
      btn.onClick(onBack);
    } else {
      btn.hide();
    }

    return () => {
      btn.offClick(onBack);
    };
  }, [pathname, navigate]);

  useEffect(() => {
    return () => {
      try {
        getWebApp()?.BackButton?.hide();
      } catch {
        /* ignore */
      }
    };
  }, []);
}
