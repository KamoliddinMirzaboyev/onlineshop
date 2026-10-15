from pydantic import BaseModel, ConfigDict


class AppVersionOut(BaseModel):
    min_version_code: int
    store_url: str | None = None
    latest_version_code: int = 0
    release_notes_uz: str | None = None
    release_notes_ru: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AppVersionIn(BaseModel):
    min_version_code: int
    store_url: str | None = None
    latest_version_code: int = 0
    release_notes_uz: str | None = None
    release_notes_ru: str | None = None
