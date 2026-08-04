/** Multi-source reverse-geocode: avval backend (Nominatim+BDC+Photon), keyin brauzer fallback. */

export interface GeoAddress {
  /** Mahalla / kvartal */
  mahalla: string;
  /** Ko'cha */
  street: string;
  /** Uy raqami */
  house: string;
  /** Shahar */
  city: string;
  /** To'liq qisqa satr */
  label: string;
  source?: string;
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const ADMIN_RE = /район|tumani|tuman|district|province|viloyat|область|region|город|shahar|республика/i;
const MAHALLA_RE = /mahalla|махалл|мфй|mfy/i;

function looksAdmin(name: string) {
  return ADMIN_RE.test(name) && !MAHALLA_RE.test(name);
}

function looksPostcode(house: string) {
  const d = house.replace(/\D/g, "");
  return d.length >= 5 && d === house.trim().replace(/\s/g, "");
}

function buildLabel(mahalla: string, street: string, house: string, city: string, fallback = ""): string {
  let mh = mahalla.trim();
  let st = street.trim();
  let ct = city.trim();
  let hs = house.trim();
  if (hs && looksPostcode(hs)) hs = "";
  if (st && looksAdmin(st)) {
    if (!ct) ct = st;
    st = "";
  }
  if (mh && looksAdmin(mh)) {
    if (!ct) ct = mh;
    mh = "";
  }
  if (ct && mh && ct.toLowerCase() === mh.toLowerCase()) ct = "";

  const bits: string[] = [];
  const push = (x: string) => {
    const t = x.trim();
    if (!t) return;
    if (bits.some((b) => b.toLowerCase() === t.toLowerCase())) return;
    bits.push(t);
  };
  push(mh);
  push(st);
  if (hs) push(hs.toLowerCase().startsWith("uy") ? hs : `uy ${hs}`);
  if (ct && !bits.some((b) => b.toLowerCase().includes(ct.toLowerCase()))) push(ct);
  return bits.join(", ") || fallback;
}

/** Nominatim address obyektidan struktura. */
function parseNominatimAddress(
  addr: Record<string, unknown> | undefined,
  display: string,
): GeoAddress {
  const g = (k: string) => s(addr?.[k]);

  const street =
    g("road") ||
    g("pedestrian") ||
    g("residential") ||
    g("footway") ||
    g("path") ||
    g("street") ||
    g("cycleway");

  let mahalla =
    g("neighbourhood") ||
    g("suburb") ||
    g("quarter") ||
    g("city_block") ||
    g("hamlet") ||
    g("city_district");

  if (mahalla && street && mahalla.toLowerCase() === street.toLowerCase()) {
    mahalla = g("suburb") || g("neighbourhood") || "";
  }

  const house = g("house_number") || g("house");
  const city = g("city") || g("town") || g("village") || g("municipality") || g("county");

  let st = street;
  let mh = mahalla;
  if (!st && !mh && display) {
    const bits = display.split(", ").map((x) => x.trim()).filter(Boolean);
    st = bits[0] || "";
    mh = bits[1] || "";
  }

  const label = buildLabel(mh, st, house, city, display.split(", ").slice(0, 4).join(", "));
  return { mahalla: mh, street: st, house, city, label, source: "nominatim" };
}

function parseBigDataCloud(d: Record<string, unknown>): GeoAddress | null {
  const street = s(d.streetName) || s(d.street);
  const house = s(d.streetNumber) || s(d.houseNumber);
  let mahalla = s(d.locality);
  const city = s(d.city) || s(d.principalSubdivision);

  const info = d.localityInfo as { administrative?: Array<{ name?: string; adminLevel?: number }> } | undefined;
  if (!mahalla && info?.administrative?.length) {
    for (let i = info.administrative.length - 1; i >= 0; i--) {
      const item = info.administrative[i];
      const name = s(item?.name);
      if (!name) continue;
      const lvl = item?.adminLevel ?? 99;
      if (lvl >= 6 || /mahalla|мфй|квартал/i.test(name)) {
        mahalla = name;
        break;
      }
    }
  }
  if (!street && !mahalla) return null;
  return {
    mahalla,
    street,
    house,
    city,
    label: buildLabel(mahalla, street, house, city),
    source: "bigdatacloud",
  };
}

function mergeGeo(...cands: Array<GeoAddress | null>): GeoAddress | null {
  const ok = cands.filter((c): c is GeoAddress => !!c && !!c.label);
  if (!ok.length) return null;
  const score = (p: GeoAddress) =>
    [p.mahalla, p.street, p.house, p.city].filter(Boolean).length;
  const base = { ...ok.reduce((a, b) => (score(b) > score(a) ? b : a)) };
  for (const p of ok) {
    if (!base.mahalla && p.mahalla) base.mahalla = p.mahalla;
    if (!base.street && p.street) base.street = p.street;
    if (!base.house && p.house) base.house = p.house;
    if (!base.city && p.city) base.city = p.city;
  }
  base.label = buildLabel(base.mahalla, base.street, base.house, base.city, ok[0].label);
  base.source = ok.map((o) => o.source).filter(Boolean).join("+");
  return base;
}

async function fromBackend(lat: number, lng: number): Promise<GeoAddress | null> {
  try {
    const base = import.meta.env.VITE_API_URL ?? "https://api.barakali-bozor.uz/api";
    const r = await fetch(
      `${base}/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      label?: string;
      mahalla?: string;
      street?: string;
      house?: string;
      city?: string;
      source?: string;
    };
    if (!d?.label) return null;
    return {
      label: d.label,
      mahalla: s(d.mahalla),
      street: s(d.street),
      house: s(d.house),
      city: s(d.city),
      source: s(d.source) || "backend",
    };
  } catch {
    return null;
  }
}

async function fromNominatim(lat: number, lng: number): Promise<GeoAddress | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=uz,ru&zoom=18`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      },
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

async function fromBigDataCloud(lat: number, lng: number): Promise<GeoAddress | null> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=uz`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!r.ok) return null;
    return parseBigDataCloud((await r.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Koordinatadan mahalla + ko'cha + uy. */
export async function reverseGeocodeParts(lat: number, lng: number): Promise<GeoAddress | null> {
  // 1) Backend (to'g'ri UA, 3 manba merge) — eng ishonchli
  const backend = await fromBackend(lat, lng);
  if (backend && backend.street && backend.mahalla) {
    return backend;
  }

  // 2) Parallel brauzer manbalari — bo'sh maydonlarni to'ldirish
  const [nom, bdc] = await Promise.all([fromNominatim(lat, lng), fromBigDataCloud(lat, lng)]);
  const merged = mergeGeo(backend, nom, bdc);
  return merged;
}

/** Orqaga mos: faqat matn. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const parts = await reverseGeocodeParts(lat, lng);
  return parts?.label ?? null;
}
