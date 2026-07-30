from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import (
    addresses, admin, admin_auth, auth, business, business_auth, catalog, courier,
    orders, platform, platform_auth, uploads,
)
from app.api.routes.uploads import UPLOAD_DIR
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Asosiy xavfsizlik headerlari (XSS, clickjacking, MIME sniff)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(self), microphone=(), camera=()"
        )
        if settings.environment == "production":
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response

# Prod'da .env.example'dagi zaif default qiymatlar bilan ishga tushishni
# taqiqlaydi — noto'g'ri sozlangan deploy jim tarzda zaif kalitlar/parollar
# bilan ochilib qolmasin.
_INSECURE_DEFAULTS = {
    "secret_key": "change-me",
    "bot_token": "changeme",
    "first_admin_password": "admin12345",
    "first_platform_password": "platform12345",
}
if settings.environment == "production":
    leaked = [
        name for name, default in _INSECURE_DEFAULTS.items()
        if getattr(settings, name) == default
    ]
    if leaked:
        raise RuntimeError(
            "Production'da default (zaif) qiymatlar ishlatilmoqda — "
            f".env'da o'zgartiring: {', '.join(leaked)}"
        )

app = FastAPI(title="Barakali Bozor API", version="1.0.0", docs_url="/docs" if settings.environment != "production" else None, redoc_url=None if settings.environment == "production" else "/redoc")
app.add_middleware(SecurityHeadersMiddleware)

if settings.environment == "production":
    # Aniq origin'lar + barcha barakali-bozor.uz subdomainlari
    # (Telegram WebView ba'zan origin variantlarini yuboradi).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r"https://([a-z0-9-]+\.)?barakali-bozor\.uz",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Dev'da wildcard — istalgan lokal port/tunnel bilan ishlash uchun.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(catalog.router)
api.include_router(addresses.router)
api.include_router(orders.router)
api.include_router(admin_auth.router)
api.include_router(admin.router)
api.include_router(courier.router)
api.include_router(uploads.router)
api.include_router(business.router)
api.include_router(business_auth.router)
api.include_router(platform.router)
api.include_router(platform_auth.router)

app.include_router(api)

# Yuklangan rasmlar — statik fayllar. Fayl nomi har yuklashda tasodifiy
# (uploads.py: secrets.token_hex) va hech qachon qayta yozilmaydi — shuning
# uchun uzoq/immutable kesh xavfsiz: brauzer/CDN qayta-qayta so'ramaydi.
# 30 kun — TMA/mijoz qayta ochganda rasm tarmoqdan emas, disk keshidan.
# Ba'zi eski .png nomli fayllar ichi WebP (reprocess) — content-type sniff.
def _sniff_image_type(path: str) -> str | None:
    try:
        with open(path, "rb") as f:
            head = f.read(12)
    except OSError:
        return None
    if head[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


class _CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=2592000, immutable"
            # Magic-byte — eski .png nomli WebP ham to'g'ri MIME oladi.
            mime = _sniff_image_type(str(UPLOAD_DIR / path))
            if mime:
                response.headers["Content-Type"] = mime
        return response


app.mount("/uploads", _CachedStaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
