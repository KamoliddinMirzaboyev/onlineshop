"""Multi-stop yetkazish marshruti — eng qisqa yo'l (TSP).

3–8 ta nuqta: to'liq permutatsiya (exact optimum).
>8: nearest-neighbor + 2-opt yaxshilash.
Koordinatasiz buyurtmalar oxiriga qo'shiladi.
Masofa: OSRM (sozlangan bo'lsa) yoki haversine (km).
"""

from __future__ import annotations

import itertools
import uuid
from dataclasses import dataclass
from typing import Callable

from app.services.geo import haversine_km
from app.services.osrm import road_distance_matrix_km

# 8! = 40320 — millisekund ichida; undan ortiq NN + 2-opt.
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


def _point(stop: RouteStop) -> tuple[float, float] | None:
    if stop.lat is None or stop.lng is None:
        return None
    return (stop.lat, stop.lng)


def _haversine(
    a: tuple[float, float] | None,
    b: tuple[float, float] | None,
) -> float:
    if a is None or b is None:
        return 0.0
    return haversine_km(a[0], a[1], b[0], b[1])


def _make_dist_fn(
    depot: tuple[float, float] | None,
    geo_stops: list[RouteStop],
) -> Callable[
    [tuple[float, float] | None, tuple[float, float] | None],
    float,
]:
    """OSRM matritsa yoki haversine. Matritsa: 0=depot (yoki yo'q), 1..=stops."""
    pts: list[tuple[float, float]] = []
    has_depot = depot is not None
    if has_depot:
        pts.append(depot)  # type: ignore[arg-type]
    for s in geo_stops:
        p = _point(s)
        if p is not None:
            pts.append(p)

    matrix = road_distance_matrix_km(pts) if len(pts) >= 2 else None
    if matrix is None:
        return _haversine

    # point → matrix index
    idx: dict[tuple[float, float], int] = {}
    for i, p in enumerate(pts):
        idx[p] = i

    def dist(
        a: tuple[float, float] | None,
        b: tuple[float, float] | None,
    ) -> float:
        if a is None or b is None:
            return 0.0
        ia, ib = idx.get(a), idx.get(b)
        if ia is None or ib is None:
            return _haversine(a, b)
        return matrix[ia][ib]

    return dist


def _path_length(
    depot: tuple[float, float] | None,
    points: list[tuple[float, float] | None],
    dist: Callable[
        [tuple[float, float] | None, tuple[float, float] | None],
        float,
    ],
) -> tuple[float, list[float]]:
    total = 0.0
    legs: list[float] = []
    prev = depot
    for p in points:
        d = dist(prev, p)
        legs.append(round(d, 3))
        total += d
        if p is not None:
            prev = p
    return total, legs


def _exact_tsp(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
    dist: Callable[
        [tuple[float, float] | None, tuple[float, float] | None],
        float,
    ],
) -> list[RouteStop]:
    if len(stops) <= 1:
        return list(stops)

    best: list[RouteStop] | None = None
    best_len = float("inf")
    for perm in itertools.permutations(stops):
        pts = [_point(s) for s in perm]
        length, _ = _path_length(depot, pts, dist)
        if length < best_len:
            best_len = length
            best = list(perm)
    return best or list(stops)


def _nearest_neighbor(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
    dist: Callable[
        [tuple[float, float] | None, tuple[float, float] | None],
        float,
    ],
) -> list[RouteStop]:
    remaining = list(stops)
    ordered: list[RouteStop] = []
    cur = depot
    while remaining:
        best_i = 0
        best_d = float("inf")
        for i, s in enumerate(remaining):
            d = dist(cur, _point(s))
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


def _two_opt(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
    dist: Callable[
        [tuple[float, float] | None, tuple[float, float] | None],
        float,
    ],
) -> list[RouteStop]:
    if len(stops) < 3:
        return list(stops)

    route = list(stops)
    improved = True
    while improved:
        improved = False
        best_len, _ = _path_length(depot, [_point(s) for s in route], dist)
        for i in range(len(route) - 1):
            for j in range(i + 1, len(route)):
                candidate = (
                    route[:i] + list(reversed(route[i : j + 1])) + route[j + 1 :]
                )
                cand_len, _ = _path_length(
                    depot, [_point(s) for s in candidate], dist
                )
                if cand_len + 1e-9 < best_len:
                    route = candidate
                    best_len = cand_len
                    improved = True
                    break
            if improved:
                break
    return route


def optimize_route(
    depot: tuple[float, float] | None,
    stops: list[RouteStop],
    *,
    route_group_id: str | None = None,
) -> OptimizedRoute:
    """Stop'larni minimal yo'l bo'yicha tartiblaydi.

    Koordinatasi yo'q buyurtmalar alohida — optimal guruhdan keyin.
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

    dist = _make_dist_fn(depot, with_coords)

    if len(with_coords) <= _EXACT_TSP_MAX:
        ordered_geo = _exact_tsp(depot, with_coords, dist)
    else:
        ordered_geo = _two_opt(
            depot, _nearest_neighbor(depot, with_coords, dist), dist
        )

    ordered = ordered_geo + without
    points = [_point(s) for s in ordered]
    total, legs = _path_length(depot, points, dist)

    return OptimizedRoute(
        order_ids=[s.order_id for s in ordered],
        leg_km=legs,
        total_km=round(total, 3),
        route_group_id=route_group_id or str(uuid.uuid4()),
    )
