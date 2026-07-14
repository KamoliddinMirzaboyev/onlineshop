from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models import Category, CategoryGroup, Product, Restaurant
from app.schemas.catalog import (
    CategoryGroupOut,
    CategoryWithSubcategories,
    ProductOut,
    RestaurantDetail,
    RestaurantOut,
    SubcategoryOut,
)
from app.services.geo import haversine_km

router = APIRouter(prefix="/restaurants", tags=["catalog"])


@router.get("", response_model=list[RestaurantOut])
def list_restaurants(db: Session = Depends(get_db), q: str | None = None):
    stmt = select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.rating.desc())
    if q:
        stmt = stmt.where(Restaurant.name.ilike(f"%{q}%"))
    return db.scalars(stmt).all()


def _build_detail(restaurant: Restaurant, db: Session) -> RestaurantDetail:
    groups = db.scalars(
        select(CategoryGroup)
        .where(CategoryGroup.restaurant_id == restaurant.id)
        .order_by(CategoryGroup.sort_order)
    ).all()

    top_categories = db.scalars(
        select(Category)
        .where(Category.restaurant_id == restaurant.id, Category.parent_id.is_(None))
        .order_by(Category.sort_order)
        .options(selectinload(Category.children).selectinload(Category.products))
    ).all()

    cat_out = []
    for top in top_categories:
        sub_out = []
        for sub in sorted(top.children, key=lambda x: x.sort_order):
            products = [
                ProductOut.model_validate(p)
                for p in sorted(sub.products, key=lambda x: x.sort_order)
                if p.is_available
            ]
            sw = SubcategoryOut.model_validate(sub)
            sw.products = products
            sub_out.append(sw)
        cw = CategoryWithSubcategories.model_validate(top)
        cw.subcategories = sub_out
        cat_out.append(cw)

    detail = RestaurantDetail.model_validate(restaurant)
    detail.categories = cat_out
    detail.category_groups = [CategoryGroupOut.model_validate(g) for g in groups]
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


@router.get("/nearest", response_model=RestaurantDetail)
def get_nearest_store(lat: float, lng: float, db: Session = Depends(get_db)):
    restaurants = db.scalars(
        select(Restaurant).where(Restaurant.is_active.is_(True))
    ).all()
    
    if not restaurants:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active stores found")
    
    nearest_restaurant = None
    min_distance = float('inf')
    
    for r in restaurants:
        if r.lat is not None and r.lng is not None:
            dist = haversine_km(lat, lng, r.lat, r.lng)
            if dist < min_distance:
                min_distance = dist
                nearest_restaurant = r
                
    if not nearest_restaurant:
        # Fallback if no restaurant has coordinates
        nearest_restaurant = restaurants[0]
        
    return _build_detail(nearest_restaurant, db)


@router.get("/{restaurant_id}", response_model=RestaurantDetail)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Restaurant not found")
    return _build_detail(restaurant, db)
