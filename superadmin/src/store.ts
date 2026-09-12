import { create } from "zustand";
import { get, post, setToken } from "./api";
import type { SuperAdmin } from "./types";

interface AuthState {
  admin: SuperAdmin | null;
  login: (username: string, password: string) => Promise<void>;
  loadMe: () => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string, newUsername?: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  admin: null,
  login: async (username, password) => {
    const res = await post<{ access_token: string; refresh_token?: string | null }>("/platform/auth/login", { username, password });
    setToken(res.access_token, res.refresh_token ?? null);
    try {
      const me = await get<SuperAdmin>("/platform/auth/me");
      set({ admin: me });
    } catch (e) {
      // /me failed after token was set — roll back so we don't end up half-authed
      setToken(null);
      set({ admin: null });
      throw e;
    }
  },
  loadMe: async () => {
    try {
      const me = await get<SuperAdmin>("/platform/auth/me");
      set({ admin: me });
    } catch {
      set({ admin: null });
    }
  },
  logout: () => {
    setToken(null);
    set({ admin: null });
  },
  changePassword: async (oldPassword, newPassword, newUsername) => {
    await post("/platform/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
      new_username: newUsername,
    });
  },
}));
