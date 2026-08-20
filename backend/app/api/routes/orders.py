from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.models import Order, User
from app.models.enums import OrderStatus
from app.schemas.order import OrderCreateIn, OrderOut
from app.services.notify import notify_new_order
from app.services.orders import cancel_order, create_order
from app.services.receipt import render_receipt
from app.services.events import courier_events

router = APIRouter(prefix="/orders", tags=["orders"])

_order_limit = rate_limiter("place_order", limit=20, window_seconds=60)


@router.post("", response_model=OrderOut, status_code=201, dependencies=[Depends(_order_limit)])
def place_order(
    data: OrderCreateIn,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = create_order(db, user, data)
    # Chekni hozir (session ochiq, items yuklangan) render qilamiz; background'da
    # detached obyektdan items o'qib bo'lmaydi.
    try:
        receipt_png = render_receipt(order)
    except Exception:
        receipt_png = None
    needs_location = order.lat is None or order.lng is None
    background.add_task(
        notify_new_order, order, user.telegram_id, receipt_png, needs_location
    )
    courier_events.publish({"type": "orders_updated", "restaurant_id": order.restaurant_id})
    return order


@router.get("", response_model=list[OrderOut])
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
    ).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.user_id == user.id)
        .options(selectinload(Order.items), selectinload(Order.assigned_courier))
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_my_order(
    order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Mijoz faqat hali qabul qilinmagan (pending) buyurtmasini bekor qila oladi."""
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.user_id == user.id)
        .options(selectinload(Order.items))
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.status != OrderStatus.pending:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Kuryerga biriktirilgan buyurtmani faqat do'kon bekor qila oladi",
        )
    order = cancel_order(db, order)
    courier_events.publish({"type": "orders_updated", "restaurant_id": order.restaurant_id})
    return order

