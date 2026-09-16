#!/bin/bash
# 2026-09-16 hodisasi — server sozlamalari (bir martalik, serverda root ishga tushiradi).
# Oldin: scp ops/monitor/server_bot.py root@SERVER:/tmp/server_bot.py.new
#
# Sabab: Contabo image'idagi /etc/cron.hourly/fstrim har soat discard yuboradi;
# host diski unda 100+ s qotdi -> IO osildi -> load 69 -> kernel soft lockup.
# /etc/cron.hourly/free har soat page cache'ni tashlaydi — keyingi har o'qish
# diskka tushadi va sekin diskda qotishni kuchaytiradi. Haftalik fstrim.timer qoladi.
set -euo pipefail
B=/root/incident-20260916
mkdir -p "$B"

for f in free fstrim; do
  if [ -f "/etc/cron.hourly/$f" ]; then mv "/etc/cron.hourly/$f" "$B/cron.hourly.$f"; fi
done
echo "cron.hourly: $(ls /etc/cron.hourly)"
systemctl enable --now fstrim.timer

# gunicorn: host qotganda worker'ni o'ldirib qayta tug'dirish (butun app import)
# yukni oshiradi — 120 s. Healthcheck har 5 s runc exec ochardi — 30 s.
C=/opt/allfoods/docker-compose.prod.yml
cp "$C" "$B/docker-compose.prod.yml.bak"
python3 - "$C" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1]); s = p.read_text()
def rep(old, new):
    global s
    if new in s:
        return
    assert s.count(old) == 1, old
    s = s.replace(old, new)
rep("--timeout 60 --access-logfile", "--timeout 120 --graceful-timeout 30 --access-logfile")
rep("      interval: 5s\n      timeout: 5s\n      retries: 5\n",
    "      interval: 30s\n      timeout: 5s\n      retries: 5\n      start_period: 30s\n      start_interval: 2s\n")
rep("      interval: 5s\n      timeout: 3s\n      retries: 5\n",
    "      interval: 30s\n      timeout: 3s\n      retries: 5\n      start_period: 30s\n      start_interval: 2s\n")
p.write_text(s)
PY
docker compose -f "$C" config -q && echo "compose valid"

if [ -f /tmp/server_bot.py.new ]; then
  cp /opt/allfoods/monitor/server_bot.py "$B/server_bot.py.bak"
  install -m 755 /tmp/server_bot.py.new /opt/allfoods/monitor/server_bot.py
  (cd /opt/allfoods/monitor && BACKUP_ENV=/opt/allfoods/backup.env python3 -c \
    "import server_bot as s; print('stalls', s.kernel_stalls(), 'load/core', round(s.load_per_core(), 2), 'keys', s.current_alert_keys())")
  systemctl restart allfoods-monitor-bot
  systemctl is-active allfoods-monitor-bot
fi

# Yangi compose sozlamalarini qo'llash (postgres/redis bir necha soniya qayta ishga tushadi)
cd /opt/allfoods
docker compose -f "$C" up -d
echo "OK. Zaxiralar: $B"
