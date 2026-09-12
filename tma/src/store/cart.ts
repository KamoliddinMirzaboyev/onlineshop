import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "../api/types";
import { qtyStep } from "../lib/format";

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartState {
  restaurantId: number | null;
  lines: Record<number, CartLine>;
  add: (product: Product) => void;
  remove: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      lines: {},

      add: (product) =>
        set((s) => {
          // single-restaurant cart: switching restaurant clears the cart
          const switching = s.restaurantId !== null && s.restaurantId !== product.restaurant_id;
          const lines = switching ? {} : { ...s.lines };
          const existing = lines[product.id];
          lines[product.id] = {
            product,
            quantity: (existing?.quantity ?? 0) + qtyStep(product.unit),
          };
          return { lines, restaurantId: product.restaurant_id };
        }),

      remove: (productId) =>
        set((s) => {
          const lines = { ...s.lines };
          delete lines[productId];
          const restaurantId = Object.keys(lines).length ? s.restaurantId : null;
          return { lines, restaurantId };
        }),

      setQty: (productId, qty) =>
        set((s) => {
          const lines = { ...s.lines };
          if (qty <= 0) {
            delete lines[productId];
          } else if (lines[productId]) {
            lines[productId] = { ...lines[productId], quantity: qty };
          }
          const restaurantId = Object.keys(lines).length ? s.restaurantId : null;
          return { lines, restaurantId };
        }),

      clear: () => set({ lines: {}, restaurantId: null }),

      // Turli mahsulot soni — miqdorlar yig'indisi emas (kg va dona aralash
      // bo'lsa bitta songa qo'shib bo'lmaydi).
      count: () => Object.keys(get().lines).length,

      total: () =>
        Object.values(get().lines).reduce((n, l) => n + l.quantity * l.product.price, 0),
    }),
    { name: "af_cart" },
  ),
);
