"""Geo helpers for delivery-zone checks (circle: center + radius km)."""

from math import asin, cos, radians, sin, sqrt

import httpx

from app.models import DeliveryZone

EARTH_RADIUS_KM = 6371.0088


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


def is_within_zone(zone: DeliveryZone, lat: float, lng: float) -> bool:
    """True if (lat,lng) is inside the circular zone."""
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


def reverse_geocode(lat: float, lng: float) -> str | None:
    """GPS koordinatadan o'qiladigan manzil matni (OpenStreetMap Nominatim).

    Mijoz manzil yozmaydi — joylashuvini yuboradi; admin/kuryer uchun o'qiladigan
    manzilni shu yerda olamiz. Xato/timeout — None (chaqiruvchi koordinataga
    qaytadi). Fire-and-forget: hech qachon buyurtmani buzmasligi kerak.
    """
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lng,
                "format": "jsonv2",
                "accept-language": "uz,ru",
                "zoom": 18,
            },
            headers={"User-Agent": "BarakaliBozor/1.0 (delivery)"},
            timeout=5,
        )
        if r.status_code == 200:
            name = r.json().get("display_name")
            if name:
                # Mamlakat/индекс qismini qisqartiramiz — birinchi 4 bo'lak yetarli.
                return ", ".join(str(name).split(", ")[:4])
    except Exception:
        pass
    return None
