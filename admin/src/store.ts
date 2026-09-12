import { create } from "zustand";
import { get, post, revokeSession, setToken } from "./api";
import type { AdminUser } from "./types";

interface AuthState {
  admin: AdminUser | null;
  login: (username: string, password: string) => Promise<void>;
  loadMe: () => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  admin: null,
  login: async (username, password) => {
    const res = await post<{ access_token: string; refresh_token?: string | null }>("/admin/auth/login", { username, password });
    setToken(res.access_token, res.refresh_token ?? null);
    try {
      const me = await get<AdminUser>("/admin/auth/me");
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
      const me = await get<AdminUser>("/admin/auth/me");
      set({ admin: me });
    } catch {
      set({ admin: null });
    }
  },
  logout: () => {
    revokeSession("/admin/auth/logout");
    setToken(null);
    set({ admin: null });
  },
  changePassword: async (oldPassword, newPassword) => {
    await post("/admin/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },
}));
