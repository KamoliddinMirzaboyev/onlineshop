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
