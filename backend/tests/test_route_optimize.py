"""Multi-stop TSP: eng qisqa marshrut tartibi."""

from app.services.route_optimize import RouteStop, optimize_route


def test_single_stop():
    r = optimize_route((40.0, 71.0), [RouteStop(1, 40.1, 71.1)])
    assert r.order_ids == [1]
    assert len(r.leg_km) == 1
    assert r.total_km > 0


def test_optimal_order_not_input_order():
    """Depot → uzoq → yaqin o'rniga depot → yaqin → uzoq."""
    depot = (40.0, 71.0)
    far = RouteStop(10, 40.20, 71.0)
    near = RouteStop(20, 40.05, 71.0)
    r = optimize_route(depot, [far, near])
    assert r.order_ids == [20, 10]
    assert abs(r.total_km - sum(r.leg_km)) < 1e-6


def test_three_stops_is_shortest_of_all_perms():
    depot = (41.3, 69.2)
    stops = [
        RouteStop(1, 41.31, 69.21),
        RouteStop(2, 41.35, 69.28),
        RouteStop(3, 41.32, 69.25),
    ]
    r = optimize_route(depot, list(reversed(stops)))
    assert set(r.order_ids) == {1, 2, 3}
    # Har qanday boshqa tartib ≥ optimal
    import itertools
    from app.services.geo import haversine_km

    def path_len(ids: list[int]) -> float:
        by = {s.order_id: s for s in stops}
        total = 0.0
        prev = depot
        for i in ids:
            s = by[i]
            total += haversine_km(prev[0], prev[1], s.lat, s.lng)  # type: ignore[arg-type]
            prev = (s.lat, s.lng)  # type: ignore[assignment]
        return total

    best = min(path_len(list(p)) for p in itertools.permutations([1, 2, 3]))
    assert abs(r.total_km - round(best, 3)) < 1e-6


def test_missing_coords_go_last():
    depot = (40.0, 71.0)
    with_geo = RouteStop(1, 40.1, 71.1)
    no_geo = RouteStop(2, None, None)
    r = optimize_route(depot, [no_geo, with_geo])
    assert r.order_ids == [1, 2]


def test_empty():
    r = optimize_route((40.0, 71.0), [])
    assert r.order_ids == []
    assert r.total_km == 0.0


def test_reopt_from_last_stop_prefers_nearby():
    """#1 yetkazilgandan keyin depot = #1 joyi → qolganlar qayta tartiblanadi."""
    # Janub 3km "yetkazildi"; qolgan: shimol 1km va shimol 5km
    last_stop = (40.0, 71.0)  # taxminan yetkazilgan nuqta
    near = RouteStop(2, 40.01, 71.0)
    far = RouteStop(3, 40.05, 71.0)
    r = optimize_route(last_stop, [far, near])
    assert r.order_ids == [2, 3]


def test_two_opt_improves_or_equals_nn_path():
    """Ko'p stop: optimize_route xato bermasligi va id lar to'liq saqlanishi."""
    depot = (41.3, 69.2)
    stops = [
        RouteStop(i, 41.3 + 0.01 * ((i * 3) % 7), 69.2 + 0.01 * ((i * 5) % 7))
        for i in range(1, 10)
    ]
    r = optimize_route(depot, stops)
    assert set(r.order_ids) == set(range(1, 10))
    assert len(r.leg_km) == 9
    assert r.total_km >= 0
