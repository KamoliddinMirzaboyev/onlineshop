#!/bin/bash
# Backend deploy — serverdagi /opt/allfoods/deploy.sh shu faylni chaqiradi.
#
# Avval skript faqat serverda turardi: o'zgarishi kodni ko'rib chiqishga
# tushmasdi va tarixi ham yo'q edi. Endi repoda — server faqat pull qilib
# shuni ishga tushiradi.
#
# ponytail: admin/businessman/tma/superadmin bu yerda YO'Q — hammasi Vercel'da,
# GitHub push'ida o'zi quriladi. Bu deploy faqat api + bot konteynerlari.
set -euo pipefail

# Bir vaqtda ikkita deploy ketmasin: CI avtomatik chaqiradi, odam ham qo'lda
# ishga tushirishi mumkin. Ikkalasi baravar `docker compose build` qilsa
# imij va konteynerlar buziladi. Ikkinchisi birinchisini 10 daqiqagacha
# kutadi, keyin taslim bo'ladi.
exec 9>/var/lock/allfoods-deploy.lock
if ! flock -w 600 9; then
  echo "!! Boshqa deploy 10 daqiqadan beri ketyapti — to'xtatildi" >&2
  exit 1
fi

REPO=${REPO:-/opt/allfoods/repo}
ROOT=${ROOT:-/opt/allfoods}
COMPOSE="docker compose -f $ROOT/docker-compose.prod.yml"
TS=$(date +%Y%m%d_%H%M%S)

echo "==> backend: joriy app/ zaxirasi, yangi kodni sinxronlash"
mkdir -p "$ROOT/backups"
tar czf "$ROOT/backups/backend_app_predeploy_${TS}.tgz" -C "$ROOT/backend" app
rsync -a --delete --exclude '__pycache__' --exclude '*.pyc' "$REPO/backend/app/" "$ROOT/backend/app/"
rsync -a --delete --exclude '__pycache__' "$REPO/backend/tests/" "$ROOT/backend/tests/"
rsync -a --delete --exclude '__pycache__' "$REPO/backend/alembic/" "$ROOT/backend/alembic/"
rsync -a --delete --exclude '__pycache__' "$REPO/backend/scripts/" "$ROOT/backend/scripts/"
cp "$REPO/backend/requirements.txt" "$ROOT/backend/requirements.txt"
cp "$REPO/backend/alembic.ini" "$ROOT/backend/alembic.ini"
cp "$REPO/backend/Dockerfile" "$ROOT/backend/Dockerfile"
cp "$REPO/backend/.dockerignore" "$ROOT/backend/.dockerignore"

# Konteyner endi root'da emas, uid 10001 ostida ishlaydi (Dockerfile: USER app).
# Mount qilingan papkalar host'da boshqa egaga tegishli bo'lsa, ilova rasm
# yuklay olmaydi va Firebase kalitini o'qiy olmaydi — egalikni to'g'rilaymiz.
echo "==> mount qilingan papkalar egaligi (uid 10001)"
mkdir -p "$ROOT/backend/uploads" "$ROOT/backend/secrets"
chown -R 10001:10001 "$ROOT/backend/uploads" "$ROOT/backend/secrets"
chmod 700 "$ROOT/backend/secrets"
find "$ROOT/backend/secrets" -type f -exec chmod 600 {} +

echo "==> build va restart"
cd "$ROOT"
$COMPOSE build api bot
$COMPOSE up -d api bot

echo "==> health check"
ok=""
for _ in $(seq 1 30); do
  if curl -sSf -o /dev/null http://127.0.0.1:18081/health; then ok=1; break; fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "!! /health 60s ichida ko'tarilmadi — tekshiring: docker logs allfoods-api-1" >&2
  exit 1
fi

# Alembic: mavjud baza migratsiyasiz yaratilgan (sxemani initdb.py qurgan).
# Birinchi marta hozirgi holatni baseline deb belgilaymiz, keyin har deploy'da
# yangi migratsiyalar qo'llanadi. `alembic current` bo'sh — hali stamp emas.
echo "==> alembic"
if $COMPOSE exec -T api alembic current 2>/dev/null | grep -q '[0-9a-f]\{12\}'; then
  $COMPOSE exec -T api alembic upgrade head
else
  echo "   alembic_version yo'q — hozirgi sxema baseline deb belgilanadi"
  $COMPOSE exec -T api alembic stamp head
fi

echo "==> deploy OK ($(git -C "$REPO" rev-parse --short HEAD))"
