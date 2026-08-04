"""Public reverse-geocode — TMA manzil satrini serverda aniqroq oladi."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.ratelimit import rate_limiter
from app.services.geo import reverse_geocode_parts

router = APIRouter(prefix="/geo", tags=["geo"])

_geo_limit = rate_limiter("geo_reverse", limit=60, window_seconds=60)


class ReverseGeoOut(BaseModel):
    label: str
    mahalla: str = ""
    street: str = ""
    house: str = ""
    city: str = ""
    source: str = ""
    lat: float
    lng: float


@router.get("/reverse", response_model=ReverseGeoOut, dependencies=[Depends(_geo_limit)])
def reverse_geo(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    parts = reverse_geocode_parts(lat, lng)
    if not parts or not parts.label:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Manzil aniqlanmadi",
        )
    return ReverseGeoOut(
        label=parts.label,
        mahalla=parts.mahalla,
        street=parts.street,
        house=parts.house,
        city=parts.city,
        source=parts.source,
        lat=lat,
        lng=lng,
    )
