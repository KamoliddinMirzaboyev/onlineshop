from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.cache import cache_get_json, cache_set_json
from app.core.db import get_db
from app.models import Category, CategoryGroup, DeliveryZone, Product, Restaurant
from app.schemas.catalog import (
    CategoryGroupOut,
    CategoryWithSubcategories,
    ProductOut,
    RestaurantDetail,
    RestaurantOut,
    SubcategoryOut,
)
from app.services.geo import haversine_km, is_within_zone, shop_origin, zone_is_configured

router = APIRouter(prefix="/restaurants", tags=["catalog"])

# ponytail: TTL-only kesh — yozishda invalidatsiya yo'q, shuning uchun admin
# o'zgartirgan mahsulot/kategoriya mijozga ~CACHE_TTL soniyagacha eski holda
# ko'rinishi mumkin. Kengaytirish kerak bo'lsa: admin/business yozish
# route'larida shu kalitlarga `redis_client.delete(...)` qo'shing.
# 2 daqiqa — katalog kam o'zgaradi; har nearest so'rovida DB/join yuki kamayadi.
CACHE_TTL = 120


@router.get("", response_model=list[RestaurantOut])
def list_restaurants(db: Session = Depends(get_db), q: str | None = None):
    cache_key = "catalog:restaurants:all"
    if not q:
        if (cached := cache_get_json(cache_key)) is not None:
            return cached
    stmt = select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.rating.desc())
    if q:
        stmt = stmt.where(Restaurant.name.ilike(f"%{q}%"))
    restaurants = db.scalars(stmt).all()
    if not q:
        payload = [RestaurantOut.model_validate(r).model_dump(mode="json") for r in restaurants]
        cache_set_json(cache_key, payload, CACHE_TTL)
    return restaurants


def _build_detail(restaurant: Restaurant, db: Session) -> RestaurantDetail:
    cache_key = f"catalog:restaurant:{restaurant.id}"
    if (cached := cache_get_json(cache_key)) is not None:
        return RestaurantDetail.model_validate(cached)

    top_categories = db.scalars(
        select(Category)
        .where(
            Category.restaurant_id == restaurant.id,
            Category.parent_id.is_(None),
            Category.is_active.is_(True),
        )
        .order_by(Category.sort_order)
        .options(selectinload(Category.children).selectinload(Category.products))
    ).all()

    cat_out = []
    for top in top_categories:
        sub_out = []
        for sub in sorted(top.children, key=lambda x: x.sort_order):
            if not sub.is_active:
                continue
            products = [
                ProductOut.model_validate(p)
                for p in sorted(sub.products, key=lambda x: x.sort_order)
                if p.is_available
            ]
            sw = SubcategoryOut.model_validate(sub)
            sw.products = products
            sub_out.append(sw)
        # Mahsuloti yo'q bo'sh kategoriya ham TMA da ko'rinsin (rasm/navigatsiya).
        cw = CategoryWithSubcategories.model_validate(top)
        cw.subcategories = sub_out
        cat_out.append(cw)

    # Faqat kamida 1 ta faol kategoriya bog'langan Title'lar.
    linked_group_ids = {c.group_id for c in top_categories if c.group_id is not None}
    groups = db.scalars(
        select(CategoryGroup)
        .where(CategoryGroup.restaurant_id == restaurant.id)
        .order_by(CategoryGroup.sort_order)
    ).all()
    groups_out = [
        CategoryGroupOut.model_validate(g) for g in groups if g.id in linked_group_ids
    ]

    detail = RestaurantDetail.model_validate(restaurant)
    detail.categories = cat_out
    detail.category_groups = groups_out
    cache_set_json(cache_key, detail.model_dump(mode="json"), CACHE_TTL)
    return detail


# Yagona do'kon — admin default_store bilan bir xil (eng kichik id).
# Param route (/{restaurant_id}) dan OLDIN turishi shart.
@router.get("/default", response_model=RestaurantDetail)
def get_default_store(db: Session = Depends(get_db)):
    restaurant = db.scalar(
        select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.id).limit(1)
    )
    if not restaurant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No store")
    return _build_detail(restaurant, db)


def _store_zone(db: Session, restaurant_id: int) -> DeliveryZone | None:
    return db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == restaurant_id, DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.id)
        .limit(1)
    )


@router.get("/nearest", response_model=RestaurantDetail)
def get_nearest_store(lat: float, lng: float, db: Session = Depends(get_db)):
    """Foydalanuvchiga eng yaqin, uni yetkazish hududi qamrab oladigan do'kon.

    Yaqinlikda tartiblab, har birining yetkazish zonasini tekshiramiz — birinchi
    mos kelgani qaytadi. Hech qaysi do'kon hududni qamramasa — 404 OUT_OF_RANGE.
    """
    restaurants = db.scalars(
        select(Restaurant).where(Restaurant.is_active.is_(True))
    ).all()
    if not restaurants:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active stores found")

    # Har bir do'kon uchun masofa hisoblash origin'i: o'zining lat/lng'i,
    # bo'lmasa yetkazish zonasi markazi (ko'p do'konlar faqat zona belgilagan).
    ranked: list[tuple[float, Restaurant, DeliveryZone | None]] = []
    for r in restaurants:
        zone = _store_zone(db, r.id)
        origin = shop_origin(r, zone)
        if origin:
            ranked.append((haversine_km(lat, lng, origin[0], origin[1]), r, zone))

    if not ranked:
        return _build_detail(restaurants[0], db)

    ranked.sort(key=lambda x: x[0])
    for _, r, zone in ranked:
        if not zone_is_configured(zone) or is_within_zone(zone, lat, lng):
            return _build_detail(r, db)

    raise HTTPException(status.HTTP_404_NOT_FOUND, "OUT_OF_RANGE")


@router.get("/{restaurant_id}", response_model=RestaurantDetail)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Restaurant not found")
    return _build_detail(restaurant, db)
