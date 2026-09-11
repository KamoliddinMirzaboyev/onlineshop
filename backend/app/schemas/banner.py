from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BannerOut(BaseModel):
    id: int
    restaurant_id: int
    title: str
    subtitle: str | None = None
    image_url: str | None = None
    link_url: str | None = None
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class BannerIn(BaseModel):
    title: str
    subtitle: str | None = None
    image_url: str | None = None
    link_url: str | None = None
    is_active: bool = True
    sort_order: int = 0
