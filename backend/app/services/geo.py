"""Geo helpers: zona, masofa, multi-source reverse-geocode (mahalla/ko'cha)."""

from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

import httpx

from app.models import DeliveryZone

EARTH_RADIUS_KM = 6371.0088
_UA = "BarakaliBozor/1.0 (delivery; contact=admin@barakali-bozor.uz)"


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in kilometers."""
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def zone_is_configured(zone: DeliveryZone | None) -> bool:
    return bool(
        zone
        and zone.is_active
        and zone.center_lat is not None
        and zone.center_lng is not None
        and zone.radius_km
    )


def is_within_zone(zone: DeliveryZone | None, lat: float, lng: float) -> bool:
    """True if (lat,lng) is inside the circular zone."""
    if zone is None or zone.center_lat is None or zone.center_lng is None or zone.radius_km is None:
        return False
    return haversine_km(zone.center_lat, zone.center_lng, lat, lng) <= zone.radius_km


def shop_origin(restaurant, zone: DeliveryZone | None) -> tuple[float, float] | None:
    """Do'kon koordinatasi (masofa origin'i): restaurant.lat/lng, bo'lmasa zona markazi."""
    if restaurant is not None and restaurant.lat is not None and restaurant.lng is not None:
        return (restaurant.lat, restaurant.lng)
    if zone is not None and zone.center_lat is not None and zone.center_lng is not None:
        return (zone.center_lat, zone.center_lng)
    return None


def distance_to_user(restaurant, zone, lat, lng) -> float | None:
    """Do'kondan mijozgacha masofa (km). Origin yoki koordinata yo'q — None."""
    if lat is None or lng is None:
        return None
    origin = shop_origin(restaurant, zone)
    if origin is None:
        return None
    return round(haversine_km(origin[0], origin[1], lat, lng), 2)


@dataclass
class GeoParts:
    """Strukturali manzil (yetkazish uchun o'qiladigan)."""

    mahalla: str = ""
    street: str = ""
    house: str = ""
    city: str = ""
    label: str = ""
    source: str = ""

    def to_label(self) -> str:
        if self.label:
            return self.label
        parts: list[str] = []
        if self.mahalla:
            parts.append(self.mahalla)
        if self.street:
            parts.append(self.street)
        if self.house:
            h = self.house if self.house.lower().startswith("uy") else f"uy {self.house}"
            parts.append(h)
        if self.city and self.city not in " ".join(parts):
            parts.append(self.city)
        return ", ".join(parts)


def _s(d: dict | None, *keys: str) -> str:
    if not d:
        return ""
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, (int, float)):
            return str(v)
    return ""


def _clean_dup(parts: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        key = p.lower().strip()
        if not key or key in seen:
            continue
        # qisman dublikat (masalan "Yangi mahalla" ichida)
        if any(key in s or s in key for s in seen if len(s) > 4):
            # uzunroq variantni saqlash
            continue
        seen.add(key)
        out.append(p.strip())
    return out


_ADMIN_RE = (
    "район", "tumani", "tuman", "district", "province", "viloyat",
    "область", "region", "город", "shahar", "city", "республика",
)


def _looks_admin(name: str) -> bool:
    low = name.lower()
    return any(a in low for a in _ADMIN_RE)


def _looks_mahalla(name: str) -> bool:
    low = name.lower()
    return "mahalla" in low or "махалл" in low or "мфй" in low or "mfy" in low


def _looks_postcode(house: str) -> bool:
    """5–6 xonali raqam odatda indeks, uy emas."""
    d = "".join(c for c in house if c.isdigit())
    return len(d) >= 5 and d == house.strip().replace(" ", "")


def _format_parts(mahalla: str, street: str, house: str, city: str, fallback: str = "") -> GeoParts:
    mahalla = mahalla.strip()
    street = street.strip()
    house = house.strip()
    city = city.strip()

    # Indeks (100000) uy raqami emas
    if house and _looks_postcode(house):
        house = ""

    # Mamlakat/ko'cha chalkashligi: "Oʻzbekiston" yo'l nomi bo'lishi mumkin — saqlaymiz
    # lekin faqat mamlakat bo'lsa tashlaymiz
    if street.lower() in {"oʻzbekiston", "o'zbekiston", "uzbekistan", "узбекистан"}:
        # agar boshqa yo'l yo'q — saqlaymiz (haqiqiy ko'cha nomi bo'lishi mumkin)
        pass

    # Tuman/район ko'cha emas
    if street and _looks_admin(street) and not _looks_mahalla(street):
        if not city:
            city = street
        street = ""

    # Mahalla o'rniga tuman tushib qolmasin
    if mahalla and _looks_admin(mahalla) and not _looks_mahalla(mahalla):
        if not city:
            city = mahalla
        mahalla = ""

    # city == mahalla dublikat
    if city and mahalla and city.lower() == mahalla.lower():
        city = ""
    if city and street and city.lower() == street.lower():
        city = ""

    # street ichida mahalla takrorlanmasin
    if mahalla and street and street.lower() in mahalla.lower():
        if _looks_mahalla(mahalla):
            street = ""
        else:
            mahalla = ""

    label_bits = _clean_dup(
        [
            mahalla,
            street,
            f"uy {house}" if house and not house.lower().startswith("uy") else house,
            city,
        ]
    )
    label = ", ".join(label_bits) if label_bits else fallback
    return GeoParts(mahalla=mahalla, street=street, house=house, city=city, label=label)


def _from_nominatim(lat: float, lng: float) -> GeoParts | None:
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lng,
                "format": "jsonv2",
                "addressdetails": 1,
                "namedetails": 1,
                "accept-language": "uz,ru,en",
                "zoom": 18,
            },
            headers={"User-Agent": _UA, "Accept-Language": "uz,ru,en"},
            timeout=6.0,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        addr = data.get("address") or {}
        display = str(data.get("display_name") or "")

        # Ko'cha: faqat yo'l maydonlari (tuman/район emas)
        street = _s(addr, "road", "pedestrian", "footway", "path", "cycleway", "street")
        # residential ba'zan mahalla nomi — admin emas bo'lsa ko'cha deb olamiz
        res = _s(addr, "residential")
        if not street and res and not _looks_admin(res):
            street = res

        mahalla = _s(
            addr,
            "neighbourhood",
            "suburb",
            "quarter",
            "city_block",
            "hamlet",
        )
        if not mahalla and res and _looks_mahalla(res):
            mahalla = res

        house = _s(addr, "house_number", "house")
        # postcode ni uy deb olmaslik
        postcode = _s(addr, "postcode")
        if house and postcode and house == postcode:
            house = ""
        city = _s(
            addr,
            "city",
            "town",
            "village",
            "municipality",
            "city_district",
            "county",
        )

        # display_name: birinchi bo'laklar (uy, ko'cha, mahalla)
        if not street and not mahalla and display:
            bits = [b.strip() for b in display.split(",") if b.strip()]
            for b in bits:
                if _looks_admin(b) and not _looks_mahalla(b):
                    city = city or b
                    continue
                if _looks_mahalla(b) and not mahalla:
                    mahalla = b
                    continue
                if not street and not b[0].isdigit():
                    street = b
                    continue
                if not house and b[0].isdigit():
                    house = b

        parts = _format_parts(
            mahalla, street, house, city, fallback=", ".join(display.split(", ")[:4])
        )
        if not parts.label:
            return None
        parts.source = "nominatim"
        return parts
    except Exception:
        return None


def _from_bigdatacloud(lat: float, lng: float) -> GeoParts | None:
    """Kalitsiz reverse-geocode — mahalla/locality ko'pincha yaxshi."""
    try:
        r = httpx.get(
            "https://api.bigdatacloud.net/data/reverse-geocode-client",
            params={
                "latitude": lat,
                "longitude": lng,
                "localityLanguage": "uz",
            },
            headers={"User-Agent": _UA},
            timeout=5.0,
        )
        if r.status_code != 200:
            return None
        d = r.json()
        street = _s(d, "streetName", "street")
        house = _s(d, "streetNumber", "houseNumber")
        mahalla = _s(d, "locality", "localityInfo")  # localityInfo may be nested
        if not mahalla and isinstance(d.get("localityInfo"), dict):
            admin = d["localityInfo"].get("administrative") or []
            if isinstance(admin, list):
                # eng past daraja — mahalla
                for item in reversed(admin):
                    if isinstance(item, dict) and item.get("name"):
                        name = str(item["name"]).strip()
                        # mamlakat/viloyat emas
                        if item.get("adminLevel", 99) >= 6 or "mahalla" in name.lower() or len(name) < 40:
                            if name and name not in (street, house):
                                mahalla = name
                                break
        city = _s(d, "city", "principalSubdivision")
        if not street and not mahalla:
            return None
        parts = _format_parts(mahalla, street, house, city)
        parts.source = "bigdatacloud"
        return parts
    except Exception:
        return None


def _from_photon(lat: float, lng: float) -> GeoParts | None:
    try:
        r = httpx.get(
            "https://photon.komoot.io/reverse",
            params={"lat": lat, "lon": lng, "lang": "en"},
            headers={"User-Agent": _UA},
            timeout=5.0,
        )
        if r.status_code != 200:
            return None
        feats = (r.json() or {}).get("features") or []
        if not feats:
            return None
        props = feats[0].get("properties") or {}
        street = _s(props, "street", "name")
        # name ba'zan POI — street bo'lsa name ni mahalla qilmaymiz
        if props.get("street") and props.get("name") and props.get("type") not in ("house", "street"):
            # POI nomi — labelga qo'shmaymiz
            pass
        house = _s(props, "housenumber")
        mahalla = _s(props, "district", "locality", "neighbourhood")
        city = _s(props, "city", "town", "village", "county", "state")
        if not street and not mahalla:
            return None
        parts = _format_parts(mahalla, street, house, city)
        parts.source = "photon"
        return parts
    except Exception:
        return None


def _merge_parts(*candidates: GeoParts | None) -> GeoParts | None:
    """Bir necha manbadan eng to'liq maydonlarni yig'adi."""
    ok = [c for c in candidates if c and c.label]
    if not ok:
        return None
    # Eng ko'p to'ldirilgan asos
    base = max(
        ok,
        key=lambda p: sum(bool(x) for x in (p.mahalla, p.street, p.house, p.city)),
    )
    for p in ok:
        if not base.mahalla and p.mahalla:
            base.mahalla = p.mahalla
        if not base.street and p.street:
            base.street = p.street
        if not base.house and p.house:
            base.house = p.house
        if not base.city and p.city:
            base.city = p.city
    base.label = ""
    base = _format_parts(base.mahalla, base.street, base.house, base.city, fallback=ok[0].label)
    sources = "+".join(sorted({c.source for c in ok if c.source}))
    base.source = sources or base.source
    return base


def reverse_geocode_parts(lat: float, lng: float) -> GeoParts | None:
    """Bir necha manbadan mahalla/ko'cha/uy — eng to'liq natija."""
    # Parallel emas — rate limit; nominatim birinchi (UA bilan), keyin boshqalar.
    nom = _from_nominatim(lat, lng)
    bdc = _from_bigdatacloud(lat, lng)
    # Photon faqat yetarli bo'lmasa
    ph = None
    if not (nom and nom.street and nom.mahalla):
        ph = _from_photon(lat, lng)
    return _merge_parts(nom, bdc, ph)


def reverse_geocode(lat: float, lng: float) -> str | None:
    """GPS → o'qiladigan manzil matni. Xato/timeout — None (buyurtmani buzmaydi)."""
    parts = reverse_geocode_parts(lat, lng)
    return parts.label if parts else None


def is_weak_address_line(line: str | None) -> bool:
    """Faqat koordinata yoki juda qisqa matn — server qayta geocode qilsin."""
    if not line or not line.strip():
        return True
    s = line.strip()
    if len(s) < 6:
        return True
    # "📍 41.12345, 69.12345" yoki sof raqamlar
    digits = sum(c.isdigit() for c in s)
    letters = sum(c.isalpha() for c in s)
    if letters < 3 and digits >= 6:
        return True
    return False
