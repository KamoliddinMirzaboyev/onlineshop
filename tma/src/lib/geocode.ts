export interface GeoAddress {
  /** Ko'cha / mahalla */
  street: string;
  /** Uy raqami (bo'sh bo'lishi mumkin) */
  house: string;
  /** To'liq qisqa satr (fallback) */
  label: string;
}

/** Nominatim address obyektidan ko'cha + uy ajratadi. */
function parseNominatimAddress(addr: Record<string, unknown> | undefined, display: string): GeoAddress {
  const s = (k: string) => {
    const v = addr?.[k];
    return typeof v === "string" ? v.trim() : "";
  };

  const road =
    s("road") ||
    s("pedestrian") ||
    s("residential") ||
    s("footway") ||
    s("path") ||
    s("street");
  const suburb = s("suburb") || s("neighbourhood") || s("quarter") || s("city_district");
  const house = s("house_number");

  let street = road;
  if (suburb && road && !road.toLowerCase().includes(suburb.toLowerCase())) {
    street = `${suburb}, ${road}`;
  } else if (!street && suburb) {
    street = suburb;
  }

  // Nominatim street bermasa — display_name ning birinchi 2-3 bo'lagi
  if (!street && display) {
    street = display.split(", ").slice(0, 2).join(", ");
  }

  const label = [street, house ? `uy ${house}` : ""].filter(Boolean).join(", ")
    || display.split(", ").slice(0, 3).join(", ");

  return { street, house, label };
}

/** Koordinatadan ko'cha + uy (OpenStreetMap Nominatim). */
export async function reverseGeocodeParts(lat: number, lng: number): Promise<GeoAddress | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=uz,ru&zoom=18`,
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      display_name?: string;
      address?: Record<string, unknown>;
    };
    if (!d?.display_name && !d?.address) return null;
    return parseNominatimAddress(d.address, String(d.display_name ?? ""));
  } catch {
    return null;
  }
}

/** Orqaga mos: faqat matn kerak bo'lsa. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const parts = await reverseGeocodeParts(lat, lng);
  return parts?.label ?? null;
}
