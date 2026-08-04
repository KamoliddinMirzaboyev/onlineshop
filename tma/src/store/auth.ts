import { create } from "zustand";
import { api, clearToken, setToken } from "../api/client";
import type { User } from "../api/types";
import { getInitData } from "../telegram";

function hasStoredToken(): boolean {
  try {
    return !!localStorage.getItem("af_token");
  } catch {
    return false;
  }
}

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
  login: () => Promise<void>;
  setUser: (u: User) => void;
}

// StrictMode double-effect + parallel login: bitta Promise.
let authPromise: Promise<void> | null = null;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,
  login: async () => {
    if (authPromise) {
      await authPromise;
      return;
    }
    authPromise = (async () => {
      try {
        const initData = getInitData();

        // 1) Yangi initData → Telegram auth (asosiy yo'l)
        if (initData) {
          try {
            const res = await api.authTelegram(initData);
            setToken(res.token.access_token);
            set({ user: res.user, ready: true, error: null });
            return;
          } catch (e) {
            clearToken();
            const msg = String(e);
            let error = "Kirish amalga oshmadi. Qayta urinib ko'ring.";
            if (msg.includes("403") || msg.toLowerCase().includes("blok")) {
              error = "Akkauntingiz bloklangan.";
            } else if (msg.includes("401") || msg.includes("Invalid initData")) {
              error =
                "Telegram tasdiqlash muvaffaqiyatsiz. Bot orqali qayta oching.";
            } else if (msg.includes("Tarmoq") || msg.includes("vaqti")) {
              error = msg.replace(/^\d+:\s*/, "");
            }
            set({ user: null, ready: true, error });
            return;
          }
        }

        // 2) initData yo'q (redirect/hash yo'qolgan) — mavjud JWT bilan /auth/me.
        if (hasStoredToken()) {
          try {
            const me = await api.me();
            set({ user: me, ready: true, error: null });
            return;
          } catch {
            clearToken();
          }
        }

        set({
          ready: true,
          user: null,
          error:
            "Telegram konteksti topilmadi. Ilovani bot orqali qayta oching.",
        });
      } finally {
        authPromise = null;
      }
    })();
    await authPromise;
  },
  setUser: (u) => set({ user: u }),
}));
