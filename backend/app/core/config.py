from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Telegram
    bot_token: str = "changeme"
    bot_username: str = "allfoodsuzbot"
    tma_url: str = "https://barakali-bozor.uz"
    # Qo'shimcha prod origin'lar (CORS). Bo'sh bo'lsa faqat tma_url ishlatiladi.
    admin_url: str = ""
    courier_url: str = ""

    # Auth
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    environment: str = "development"
    api_base_url: str = "https://allfoodapi.webportfolio.uz"

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
    first_admin_password: str = "admin12345"

    # Platform superadmin bootstrap
    first_platform_username: str = "platform"
    first_platform_password: str = "platform12345"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins(self) -> list[str]:
        """Prod uchun aniq origin ro'yxati (development'da wildcard ishlatiladi).

        Lokal frontend (vite dev) prod API'ga ulana olishi uchun localhost
        portlari ham har doim ruxsat etiladi: tma 5173, admin 3000/5174,
        courier 3001/5175.
        """
        localhost_dev = [
            "http://localhost:5173", "http://127.0.0.1:5173",  # tma
            "http://localhost:3000", "http://127.0.0.1:3000",  # admin
            "http://localhost:3001", "http://127.0.0.1:3001",  # courier
            "http://localhost:5174", "http://127.0.0.1:5174",  # admin (eski port)
            "http://localhost:5175", "http://127.0.0.1:5175",  # courier (eski port)
        ]
        origins = [self.tma_url, self.admin_url, self.courier_url, *localhost_dev]
        # Apex TMA domeni uchun www. varianti ham (DNS redirect bo'lmasa ham CORS ishlasin).
        if self.tma_url.startswith("https://") and not self.tma_url.startswith("https://www."):
            host = self.tma_url.removeprefix("https://").split("/")[0]
            origins.append(f"https://www.{host}")
        return [o for o in origins if o]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
