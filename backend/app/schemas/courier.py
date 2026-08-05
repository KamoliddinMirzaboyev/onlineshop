from datetime import date

from pydantic import BaseModel, Field


class StatBucket(BaseModel):
    delivered: int = 0
    earnings: int = 0          # sum of delivery_fee on delivered orders
    cancelled: int = 0


class DaySeries(BaseModel):
    date: date
    delivered: int = 0
    earnings: int = 0


class CourierStats(BaseModel):
    today: StatBucket
    week: StatBucket
    month: StatBucket
    active: int = 0            # orders currently ready/delivering
    series: list[DaySeries] = []   # last 7 days, oldest first


class EarningsDay(BaseModel):
    date: date
    delivered: int = 0
    earnings: int = 0


class EarningsOut(BaseModel):
    days: int
    total_delivered: int = 0
    total_earnings: int = 0
    series: list[EarningsDay] = []   # oldest first


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=128)
    new_username: str | None = Field(default=None, min_length=3, max_length=64)


class ProfileUpdateIn(BaseModel):
    """Kuryer ism/familiya va telefon."""
    name: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)

class OrderAdjustItemIn(BaseModel):
    order_item_id: int
    quantity: float = Field(ge=0)  # 0 means item is removed or out of stock

class OrderAdjustIn(BaseModel):
    items: list[OrderAdjustItemIn]

class LocationUpdateIn(BaseModel):
    lat: float
    lng: float


class RouteStartIn(BaseModel):
    """Yo'lga chiqish: accepted buyurtmalarni optimal tartibda delivering qiladi.

    order_ids bo'sh/None → shu kuryerning barcha accepted buyurtmalari.
    """
    order_ids: list[int] | None = None
