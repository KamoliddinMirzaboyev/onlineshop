from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Telegram
    bot_token: str = "changeme"
    bot_username: str = "barakalibozorobot"
    tma_url: str = "https://www.barakali-bozor.uz"
    # Prod CORS origin'lar (faqat scheme+host; path e'tiborga olinmaydi).
    admin_url: str = "https://admin.barakali-bozor.uz"
    courier_url: str = "https://kuryer.barakali-bozor.uz"
    business_url: str = "https://tadbirkor.barakali-bozor.uz"
    platform_url: str = ""  # superadmin PWA (ixtiyoriy)
    # Qo'shimcha origin'lar: vergul bilan (migratsiya / eski domenlar).
    extra_cors_origins: str = ""

    # Auth
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    environment: str = "development"
    api_base_url: str = "https://api.barakali-bozor.uz"

    # Telegram chat that receives new-order notifications (group/channel id)
    orders_chat_id: int | None = None

    # DB
    postgres_user: str = "allfoods"
    postgres_password: str = "allfoods"
    postgres_db: str = "allfoods"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    # Har bir gunicorn worker o'z pool'iga ega — jami ulanish soni taxminan
    # workers * (db_pool_size + db_max_overflow). Postgres max_connections'dan
    # oshmasligi kerak (default 100).
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 1800

    redis_url: str = "redis://redis:6379/0"

    # Web Push (VAPID) — admin PWA notifications
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@allfoods.uz"

    # Admin bootstrap
    first_admin_username: str = "admin"
    first_admin_password: str = ""

    # Platform superadmin bootstrap
    first_platform_username: str = "platform"
    first_platform_password: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @staticmethod
    def _as_origin(url: str) -> str:
        """Brauzer Origin headeri path'siz: scheme://host[:port]."""
        from urllib.parse import urlparse

        raw = (url or "").strip()
        if not raw:
            return ""
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        if not parsed.scheme or not parsed.netloc:
            return ""
        return f"{parsed.scheme}://{parsed.netloc}"

    @property
    def cors_origins(self) -> list[str]:
        """Prod uchun aniq origin ro'yxati (development'da wildcard ishlatiladi).

        Lokal frontend (vite dev) prod API'ga ulana olishi uchun localhost
        portlari ham har doim ruxsat etiladi.
        """
        localhost_dev = [
            "http://localhost:5173", "http://127.0.0.1:5173",  # tma
            "http://localhost:3000", "http://127.0.0.1:3000",  # admin
            "http://localhost:3001", "http://127.0.0.1:3001",  # courier
            "http://localhost:5174", "http://127.0.0.1:5174",  # admin (eski port)
            "http://localhost:5175", "http://127.0.0.1:5175",  # courier (eski port)
            "http://localhost:5176", "http://127.0.0.1:5176",  # businessman
            "http://localhost:5177", "http://127.0.0.1:5177",  # superadmin
        ]
        configured = [
            self.tma_url,
            self.admin_url,
            self.courier_url,
            self.business_url,
            self.platform_url,
            *self.extra_cors_origins.split(","),
        ]
        origins: list[str] = []
        for item in configured:
            origin = self._as_origin(item)
            if origin and origin not in origins:
                origins.append(origin)
        # TMA apex ↔ www juftligi (redirect bo'lmasa ham CORS ishlasin).
        for origin in list(origins):
            if origin.startswith("https://www."):
                apex = "https://" + origin.removeprefix("https://www.")
                if apex not in origins:
                    origins.append(apex)
            elif origin.startswith("https://") and origin.count(".") >= 1:
                host = origin.removeprefix("https://")
                if not host.startswith("www.") and host.count(".") == 1:
                    www = f"https://www.{host}"
                    if www not in origins:
                        origins.append(www)
        for item in localhost_dev:
            if item not in origins:
                origins.append(item)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
