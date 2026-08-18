"""OSRM table API — real yo'l masofasi (ixtiyoriy).

OSRM_BASE_URL bo'sh bo'lsa yoki so'rov muvaffaqiyatsiz bo'lsa — None qaytadi
(chaqiruvchi haversine ga tushadi).
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

# OSRM table: max ~100 points; bizda max 8+depot.
_TIMEOUT = 4.0


def road_distance_matrix_km(
    points: list[tuple[float, float]],
) -> list[list[float]] | None:
    """N×N masofa matritsasi (km). points = [(lat,lng), ...].

    OSRM format: lon,lat. annotations=distance → metr.
    """
    base = (settings.osrm_base_url or "").strip().rstrip("/")
    if not base or len(points) < 2:
        return None

    # lon,lat;lon,lat
    coords = ";".join(f"{lng},{lat}" for lat, lng in points)
    url = f"{base}/table/v1/driving/{coords}"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.get(url, params={"annotations": "distance"})
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        log.warning("OSRM table failed: %s", e)
        return None

    if data.get("code") != "Ok":
        log.warning("OSRM code=%s", data.get("code"))
        return None

    distances = data.get("distances")
    if not distances or len(distances) != len(points):
        return None

    matrix: list[list[float]] = []
    for row in distances:
        if not row or len(row) != len(points):
            return None
        matrix.append(
            [
                round((d if d is not None else 0.0) / 1000.0, 3)
                for d in row
            ]
        )
    return matrix
