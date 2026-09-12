import { create } from "zustand";
import { get, post, revokeSession, setToken } from "./api";
import type { Business, Store as StoreT } from "./types";

interface AuthState {
  business: Business | null;
  login: (username: string, password: string) => Promise<void>;
  loadMe: () => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string, newUsername?: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  business: null,
  login: async (username, password) => {
    const res = await post<{ access_token: string; refresh_token?: string | null }>("/business/auth/login", { username, password });
    setToken(res.access_token, res.refresh_token ?? null);
    try {
      const me = await get<Business>("/business/auth/me");
      set({ business: me });
    } catch (e) {
      // /me failed after token was set — roll back so we don't end up half-authed
      setToken(null);
      set({ business: null });
      throw e;
    }
  },
  loadMe: async () => {
    try {
      const me = await get<Business>("/business/auth/me");
      set({ business: me });
    } catch {
      set({ business: null });
    }
  },
  logout: () => {
    revokeSession("/business/auth/logout");
    setToken(null);
    set({ business: null });
  },
  changePassword: async (oldPassword, newPassword, newUsername) => {
    await post("/business/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
      new_username: newUsername,
    });
  },
}));

// Tanlangan do'kon — barcha per-do'kon so'rovlari shu id bilan ketadi.
// "all" = barcha do'konlar bo'yicha jamlangan ko'rinish.
// localStorage'da saqlanadi (`af_business_store`), sahifa yangilansa qoladi.
interface StoreState {
  selectedStoreId: number | "all" | null;
  setSelectedStore: (id: number | "all") => void;
  stores: StoreT[];
  loadStores: () => Promise<void>;
}

const STORE_KEY = "af_business_store";
const saved = localStorage.getItem(STORE_KEY);

export const useStore = create<StoreState>((set, getState) => ({
  selectedStoreId: saved ? (saved === "all" ? "all" : Number(saved)) : null,
  setSelectedStore: (id) => {
    localStorage.setItem(STORE_KEY, String(id));
    set({ selectedStoreId: id });
  },
  stores: [],
  loadStores: async () => {
    const data = await get<StoreT[]>("/business/stores");
    set({ stores: data });
    const { selectedStoreId, setSelectedStore } = getState();
    const valid = selectedStoreId === "all" || data.some((s) => s.id === selectedStoreId);
    if (data.length && !valid) setSelectedStore(data[0].id);
  },
}));
