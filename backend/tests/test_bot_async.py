"""Bot handlerlari event loop'ni bloklamaydi.

Bot bitta event loop'da ishlaydi: `async def` handler ichidan sinxron DB
yoki tashqi HTTP chaqirilsa, o'sha vaqt davomida BUTUN bot to'xtaydi.
"""

import inspect
import re

from app.bot import arepo, handlers, middleware, onboarding, repo


def test_threaded_wrappers_cover_every_db_function():
    """`repo` ga yangi DB funksiyasi qo'shilsa, u ham thread'ga o'ralishi kerak."""
    pure = {"split_full_name", "is_onboarded"}
    db_funcs = {
        name for name, fn in vars(repo).items()
        if inspect.isfunction(fn) and fn.__module__ == repo.__name__
        and not name.startswith("_") and name not in pure
    }
    wrapped = {
        name for name, fn in vars(arepo).items()
        if inspect.iscoroutinefunction(fn)
    }
    assert db_funcs <= wrapped, f"arepo'da yo'q: {db_funcs - wrapped}"


def test_pure_helpers_are_not_wrapped():
    """Sof funksiyalarni thread'ga chiqarish keraksiz ortiqcha ish."""
    assert not hasattr(arepo, "split_full_name")
    assert not hasattr(arepo, "is_onboarded")


def test_handlers_never_call_sync_repo_db_functions():
    db_names = [n for n in vars(arepo) if inspect.iscoroutinefunction(getattr(arepo, n))]
    for module in (handlers, onboarding, middleware):
        src = inspect.getsource(module)
        for name in db_names:
            bad = re.search(rf"(?<!a)repo\.{name}\(", src)
            assert not bad, f"{module.__name__}: repo.{name}() sinxron chaqirilgan"


def test_set_order_location_does_not_call_external_geocode():
    """Joylashuv yuborilganda bot 16 soniya muzlab qolmasin."""
    src = inspect.getsource(repo.set_order_location)
    assert "cached_reverse_geocode" in src
    assert re.search(r"[^_]reverse_geocode\(", src) is None


def test_location_handler_schedules_background_refinement():
    src = inspect.getsource(handlers)
    assert "refine_order_address" in src
    assert "to_thread" in src
