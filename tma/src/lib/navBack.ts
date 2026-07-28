import type { NavigateFunction } from "react-router-dom";

/** Bottom-nav ildiz sahifalar — shu yerda BackButton yashirin, tizim orqaga Mini App yopadi. */
export const TAB_ROOTS = new Set(["/", "/search", "/orders", "/profile"]);

export function isNestedPath(pathname: string): boolean {
  return !TAB_ROOTS.has(pathname);
}

/** Nested route uchun aniq ota sahifa — history(-1) TMA ni yopib yubormasligi uchun. */
export function parentPath(pathname: string): string {
  if (pathname.startsWith("/orders/")) return "/orders";
  if (pathname.startsWith("/category/")) return "/";
  if (pathname === "/checkout") return "/cart";
  if (pathname === "/cart") return "/";
  return "/";
}

/**
 * Ichki sahifadan orqaga: har doim SPA ichida qolamiz.
 * `navigate(-1)` ba'zi Telegram WebView'larda Mini App ni yopib yuboradi
 * (history stack bo'sh yoki tashqi entry).
 */
export function goBack(navigate: NavigateFunction, pathname: string): void {
  if (!isNestedPath(pathname)) {
    navigate("/");
    return;
  }
  navigate(parentPath(pathname));
}
