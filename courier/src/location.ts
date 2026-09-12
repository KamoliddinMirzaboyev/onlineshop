import { post } from "./api";

let watchId: number | null = null;

// `watchPosition` harakatda sekundiga bir necha marta ishga tushadi. Har
// safar server'ga yozsak — har fire'da DB UPDATE + commit + SSE event, va
// kuryer telefoni tez o'tiradi. Flutter ilovasida `distanceFilter: 15` bor;
// web versiyada shu filtr qo'lda qilinadi.
const MIN_DISTANCE_M = 15;
const MIN_INTERVAL_MS = 10_000;

let lastSent: { lat: number; lng: number; at: number } | null = null;

/** Ikki nuqta orasidagi masofa, metrda (haversine). */
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function shouldSend(lat: number, lng: number): boolean {
  if (!lastSent) return true;
  const movedEnough =
    distanceMeters(lastSent.lat, lastSent.lng, lat, lng) >= MIN_DISTANCE_M;
  const waitedEnough = Date.now() - lastSent.at >= MIN_INTERVAL_MS;
  return movedEnough && waitedEnough;
}

export function startLocationTracking() {
  if (watchId !== null) return;
  if (!("geolocation" in navigator)) {
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      if (!shouldSend(latitude, longitude)) return;
      // Optimistik belgilash: so'rov ketayotganda kelgan navbatdagi fire
      // ikkinchi so'rovni boshlamasin.
      lastSent = { lat: latitude, lng: longitude, at: Date.now() };
      try {
        await post("/courier/location", { lat: latitude, lng: longitude });
      } catch {
        // offline / 401 — keyingi harakatda qayta urinadi
        lastSent = null;
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
  lastSent = null;
}

/** Marshrut uchun bir martalik GPS (best-effort). */
export function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Marshrut uchun bir martalik so'rov — filtrdan o'tkazmaymiz, lekin
        // navbatdagi watch fire'i darhol takrorlamasin.
        lastSent = { lat, lng, at: Date.now() };
        void post("/courier/location", { lat, lng }).catch(() => {});
        resolve({ lat, lng });
      },
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
    );
  });
}
