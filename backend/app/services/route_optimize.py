"""Multi-stop yetkazish marshruti — eng qisqa yo'l (TSP).

3–8 ta nuqta: to'liq permutatsiya (exact optimum).
Koordinatasiz buyurtmalar oxiriga (created_at tartibida) qo'shiladi.
Masofa: haversine (km). Real yo'l tarmog'i keyinroq (OSRM) ulanishi mumkin.
"""

from __future__ import annotations

import itertools
import uuid
from dataclasses import dataclass

from app.services.geo import haversine_km

# 8! = 40320 — millisekund ichida; undan ortiq nearest-neighbor.
_EXACT_TSP_MAX = 8


@dataclass(frozen=True)
class RouteStop:
    order_id: int
    lat: float | None
    lng: float | None


@dataclass(frozen=True)
class OptimizedRoute:
    """Optimal tartib + leg masofalari (depot→1, 1→2, …)."""

    order_ids: list[int]
    leg_km: list[float]  # len == len(order_ids)
    total_km: float
    route_group_id: str


def _dist(
    a: tuple[float, float] | None,
    b: tuple[float, float] | None,
) -> float:
    if a is None or b is None:
        return 0.0
    return haversine_km(a[0], a[1], b[0], b[1])


def _point(stop: RouteStop) -> tuple[float, float] | None:
    if stop.lat is None or stop.lng is None:
        return None
    return (stop.lat, stop.lng)


def _path_length(
    depot: tuple[float, float] | None,
    points: list[tuple[float, float] | None],
) -> tuple[float, list[float]]:
    total = 0.0
    legs: list[float] = []
    prev = depot
    for p in points:
        d = _dist(prev, p)
        legs.append(round(d, 3))
        total += d
        if p is not None:
            prev = p
    return total, legs


def _exact_tsp(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
) -> list[RouteStop]:
    """Barcha permutatsiyalar ichidan eng qisqa yo'l."""
    if len(stops) <= 1:
        return list(stops)

    best: list[RouteStop] | None = None
    best_len = float("inf")
    for perm in itertools.permutations(stops):
        pts = [_point(s) for s in perm]
        length, _ = _path_length(depot, pts)
        if length < best_len:
            best_len = length
            best = list(perm)
    return best or list(stops)


def _nearest_neighbor(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
) -> list[RouteStop]:
    remaining = list(stops)
    ordered: list[RouteStop] = []
    cur = depot
    while remaining:
        best_i = 0
        best_d = float("inf")
        for i, s in enumerate(remaining):
            d = _dist(cur, _point(s))
            # Koordinatasiz — oxiriga surish uchun katta "masofa"
            if _point(s) is None:
                d = 1e9
            if d < best_d:
                best_d = d
                best_i = i
        nxt = remaining.pop(best_i)
        ordered.append(nxt)
        p = _point(nxt)
        if p is not None:
            cur = p
    return ordered


def optimize_route(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
    *,
    route_group_id: str | None = None,
) -> OptimizedRoute:
    """Stop'larni minimal yo'l bo'yicha tartiblaydi.

    Koordinatasi yo'q buyurtmalar alohida — optimal guruhdan keyin created tartibida.
    """
    if not stops:
        return OptimizedRoute(
            order_ids=[],
            leg_km=[],
            total_km=0.0,
            route_group_id=route_group_id or str(uuid.uuid4()),
        )

    with_coords = [s for s in stops if s.lat is not None and s.lng is not None]
    without = [s for s in stops if s.lat is None or s.lng is None]

    if len(with_coords) <= _EXACT_TSP_MAX:
        ordered_geo = _exact_tsp(depot, with_coords)
    else:
        ordered_geo = _nearest_neighbor(depot, with_coords)

    ordered = ordered_geo + without
    points = [_point(s) for s in ordered]
    total, legs = _path_length(depot, points)

    return OptimizedRoute(
        order_ids=[s.order_id for s in ordered],
        leg_km=legs,
        total_km=round(total, 3),
        route_group_id=route_group_id or str(uuid.uuid4()),
    )
