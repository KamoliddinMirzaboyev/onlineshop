import { post } from "./api";

let watchId: number | null = null;

export function startLocationTracking() {
  if (watchId !== null) return;
  if (!("geolocation" in navigator)) {
    console.warn("Geolocation is not supported by this browser.");
    return;
  }

  // watchPosition will trigger whenever the device location changes.
  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        await post("/courier/location", { lat: latitude, lng: longitude });
        console.log("Location sent successfully", { lat: latitude, lng: longitude });
      } catch (e) {
        console.error("Failed to send location", e);
      }
    },
    (err) => {
      console.error("Geolocation error:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    }
  );
  console.log("Started location tracking, watchId:", watchId);
}

export function stopLocationTracking() {
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
    console.log("Stopped location tracking, watchId:", watchId);
    watchId = null;
  }
}
