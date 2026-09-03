import { cacheAddressLabel, type Coords, getCoords, peekCoords } from "../api/client";
import { reverseGeocodeParts } from "./geocode";

// Checkout'gacha bo'lgan sahifalarda (savatcha) yuqori aniqlikdagi joylashuv +
// reverse-geocode ni oldindan oladi. Checkout ochilganda Manzil maydoni darhol
// to'la turadi. Submit baribir yangi GPS oladi — bu faqat UX tezligi uchun.

let inflight: Promise<Coords | null> | null = null;
/** Shu vaqtdan yangi fix bo'lsa qayta olmaymiz. */
const FRESH_MS = 60_000;

export function prewarmCheckoutLocation(): Promise<Coords | null> {
  const warm = peekCoords();
  if (warm?.at != null && Date.now() - warm.at < FRESH_MS) {
    return Promise.resolve(warm);
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const coords = await getCoords({ force: true, highAccuracy: true });
      if (coords) {
        const geo = await reverseGeocodeParts(coords.lat, coords.lng);
        cacheAddressLabel(
          geo?.label || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
        );
      }
      return coords;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
