#!/bin/bash
# Barakali Bozor — Caddy veb-serverida rasmlarni to'g'ridan-to'g'ri (sendfile)
# tarqatishni sozlash. Bu FastAPI (Python) worker'larini rasm uzatish yukidan
# 100% ozod qiladi va rasm yuklash tezligini bir necha barobar oshiradi.
set -euo pipefail

CADDYFILE="/etc/caddy/Caddyfile"
ROOT="/opt/allfoods"

if [ ! -f "$CADDYFILE" ]; then
  echo "Xato: $CADDYFILE topilmadi." >&2
  exit 1
fi

# Uploads papkasini Caddy o'qiy olishi uchun ruxsat berish
chmod 755 "$ROOT/backend/uploads" || true
find "$ROOT/backend/uploads" -type f -exec chmod 644 {} + 2>/dev/null || true

# Agar Caddyfile'da allaqachon /uploads file_server bo'lsa, o'tkazib yuboramiz
if grep -q "handle /uploads/\*" "$CADDYFILE"; then
  echo "Caddyfile'da /uploads allaqachon sozlangan."
  systemctl reload caddy
  echo "Caddy qayta yuklandi: OK"
  exit 0
fi

# Zaxira nusxa
cp "$CADDYFILE" "${CADDYFILE}.bak_$(date +%Y%m%d_%H%M%S)"

# Caddyfile'ga /uploads handle bloki qo'shish
python3 - <<'PY'
import re
from pathlib import Path

p = Path("/etc/caddy/Caddyfile")
content = p.read_text()

snippet = """    # Statik rasmlarni to'g'ridan-to'g'ri Caddy orqali uzatish (Python worker'larni band qilmaydi)
    handle /uploads/* {
        root * /opt/allfoods/backend
        file_server
        header Cache-Control "public, max-age=2592000, immutable"
    }

"""

# api.barakali-bozor.uz bloki ichiga reverse_proxy'dan oldin qo'shish
if "api.barakali-bozor.uz" in content:
    pattern = r"(api\.barakali-bozor\.uz[^{]*\{[^}]*?)(reverse_proxy)"
    if re.search(pattern, content, re.DOTALL):
        new_content = re.sub(pattern, r"\1" + snippet + r"    \2", content, count=1, flags=re.DOTALL)
        p.write_text(new_content)
        print("Caddyfile yangilandi (api bloki ichiga qo'shildi).")
    else:
        print("reverse_proxy topilmadi, Caddyfile o'zgartirilmadi.")
else:
    print("api.barakali-bozor.uz topilmadi.")
PY

# Validatsiya va reload
if caddy validate --config "$CADDYFILE"; then
  systemctl reload caddy
  echo "Caddy muvaffaqiyatli yangilandi va qayta ishga tushdi!"
else
  echo "Caddyfile tekshiruvdan o'tmadi, zaxira tiklanmoqda..."
  cp "${CADDYFILE}.bak_$(date +%Y%m%d_%H%M%S)" "$CADDYFILE"
  exit 1
fi
