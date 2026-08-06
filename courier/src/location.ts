import { post } from "./api";

let watchId: number | null = null;

export function startLocationTracking() {
  if (watchId !== null) return;
  if (!("geolocation" in navigator)) {
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        await post("/courier/location", { lat: latitude, lng: longitude });
      } catch {
        /* offline / 401 — keyingi tickda qayta urinadi */
      }
    },
    () => {
      /* foydalanuvchi ruxsat bermasa yoki GPS o'chiq */
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    }
  );
}

export function stopLocationTracking() {
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/** Marshrut uchun bir martalik GPS (best-effort). */
export function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        void post("/courier/location", { lat, lng }).catch(() => {});
        resolve({ lat, lng });
      },
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
    );
  });
}
