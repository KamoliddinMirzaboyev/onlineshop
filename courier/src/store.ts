import { create } from "zustand";
import { get, patch, post, setToken } from "./api";
import { clearCache } from "./lib/cache";
import { syncPush } from "./push";

interface AuthMe {
  username: string;
  role: string;
  name?: string | null;
  phone?: string | null;
}

interface AuthState {
  username: string | null;
  name: string | null;
  phone: string | null;
  role: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

interface OrderAlertState {
  availableCount: number;
  setAvailableCount: (n: number) => void;
}

export const useOrderAlerts = create<OrderAlertState>((set) => ({
  availableCount: 0,
  setAvailableCount: (n) => set({ availableCount: n }),
}));

function applyMe(me: AuthMe) {
  return {
    username: me.username,
    role: me.role,
    name: me.name ?? null,
    phone: me.phone ?? null,
  };
}

/** Login / restart: ruxsat so'rash + subscribe (best-effort). */
async function ensurePush() {
  try {
    await syncPush();
  } catch {
    /* ignore */
  }
}

export const useAuth = create<AuthState>((set) => ({
  username: null,
  name: null,
  phone: null,
  role: null,
  login: async (username, password) => {
    const res = await post<{ access_token: string }>("/admin/auth/login", { username, password });
    setToken(res.access_token);
    try {
      const me = await get<AuthMe>("/admin/auth/me");
      if (me.role !== "courier") {
        setToken(null);
        throw new Error("Faqat kuryer hisobi ruxsat etilgan");
      }
      set(applyMe(me));
      void ensurePush();
    } catch (err) {
      setToken(null);
      set({ username: null, name: null, phone: null, role: null });
      throw err;
    }
  },
  logout: () => {
    setToken(null);
    clearCache();
    set({ username: null, name: null, phone: null, role: null });
  },
  loadMe: async () => {
    const me = await get<AuthMe>("/admin/auth/me");
    set(applyMe(me));
    void ensurePush();
  },
  updateProfile: async (data) => {
    const me = await patch<AuthMe>("/admin/auth/me", data);
    set(applyMe(me));
  },
  changePassword: async (oldPassword, newPassword) => {
    await post("/admin/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },
}));
