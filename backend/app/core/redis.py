import redis
import redis.asyncio as aioredis

from app.core.config import settings

redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

# Async klient — faqat uzoq yashaydigan ulanishlar uchun (SSE Pub/Sub).
# Sinxron klientni thread'da kutish har bir ochiq oqimga bitta thread band
# qilardi (standart executor ~32 ta) — kuryerlar soni oshganda yangi oqimlar
# ochilmay qolardi.
async_redis_client = aioredis.Redis.from_url(settings.redis_url, decode_responses=True)
