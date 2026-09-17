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

/** Kirish umuman mumkin bo'lmagan holatlar — ilova o'rniga to'siq ekrani. */
export type AuthGateReason = "onboarding" | "blocked";

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
  gate: AuthGateReason | null;
  login: () => Promise<void>;
  setUser: (u: User) => void;
}

// StrictMode double-effect + parallel login: bitta Promise.
let authPromise: Promise<void> | null = null;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,
  gate: null,
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
            set({ user: res.user, ready: true, error: null, gate: null });
            return;
          } catch (e) {
            clearToken();
            const msg = String(e);
            let error = "Kirish amalga oshmadi. Qayta urinib ko'ring.";
            let gate: AuthGateReason | null = null;
            if (msg.includes("onboarding_required")) {
              gate = "onboarding";
            } else if (msg.includes("403") || msg.toLowerCase().includes("blok")) {
              gate = "blocked";
            } else if (msg.includes("401") || msg.includes("Invalid initData")) {
              error =
                "Telegram tasdiqlash muvaffaqiyatsiz. Bot orqali qayta oching.";
            } else if (msg.includes("Tarmoq") || msg.includes("vaqti")) {
              error = msg.replace(/^\d+:\s*/, "");
            }
            set({ user: null, ready: true, error: gate ? null : error, gate });
            return;
          }
        }

        // 2) initData yo'q (redirect/hash yo'qolgan) — mavjud JWT bilan /auth/me.
        if (hasStoredToken()) {
          try {
            const me = await api.me();
            set({ user: me, ready: true, error: null, gate: null });
            return;
          } catch {
            clearToken();
          }
        }

        set({
          ready: true,
          user: null,
          gate: null,
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
