# ops/

`deploy.sh` — backend (api + bot) serverga chiqarish skripti.

Serverdagi `/opt/allfoods/deploy.sh` faqat bootstrap: `git fetch && git reset
--hard origin/main`, keyin shu fayldagi `ops/deploy.sh` ni ishga tushiradi.
Shuning uchun deploy mantig'ini o'zgartirish uchun serverga kirish shart emas
— shu faylni tahrirlab, main'ga push qilish kifoya.

Bootstrap (serverda bir marta o'rnatiladi):

```bash
cat > /opt/allfoods/deploy.sh <<'SH'
#!/bin/bash
set -euo pipefail
REPO=/opt/allfoods/repo
cd "$REPO"
git fetch origin main
git reset --hard origin/main
exec bash "$REPO/ops/deploy.sh"
SH
chmod +x /opt/allfoods/deploy.sh
```

CI (`.github/workflows/ci.yml`) main'ga push'da testlar o'tgach SSH orqali
aynan `/opt/allfoods/deploy.sh` ni chaqiradi. Kerakli GitHub secrets:
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`.
