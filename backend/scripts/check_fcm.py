"""FCM sozlamasini tekshiradi — push kelmasa BIRINCHI shu ishga tushiriladi.

    python -m scripts.check_fcm                  # sozlamani tekshiradi
    python -m scripts.check_fcm --user-id 12     # o'sha mijozga test push
    python -m scripts.check_fcm --courier-id 3   # o'sha kuryerga test push

Nima uchun kerak: FCM xatosi JIM ketadi — push yuborilmagani serverda ham,
ilovada ham ko'rinmaydi. Eng ko'p uchraydigan sabab: ilovaning
`google-services.json` dagi project_id serverning service account'idagi
project_id bilan mos emas (token loyihaga bog'langan → SenderId mismatch).
"""

import argparse
import json
import plistlib
import sys
from pathlib import Path

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import AdminUser, User
from app.services import fcm

REPO = Path(__file__).resolve().parents[2]

# Ilova konfiguratsiyalari: (nom, fayl, o'qish funksiyasi, qaysi server app'i)
_APP_CONFIGS = [
    ("mijoz android", "mijoz_app/android/app/google-services.json", "json", "mijoz"),
    ("mijoz ios", "mijoz_app/ios/Runner/GoogleService-Info.plist", "plist", "mijoz"),
    ("kuryer android", "kuryer/android/app/google-services.json", "json", "kuryer"),
]


def _project_of(app) -> str:
    try:
        return app.project_id or "?"
    except Exception:  # noqa: BLE001
        return "?"


def _read_app_project(path: Path, kind: str) -> tuple[str | None, str | None]:
    """(project_id, package/bundle) — fayl yo'q yoki buzuq bo'lsa (None, None)."""
    try:
        if kind == "json":
            data = json.loads(path.read_text(encoding="utf-8"))
            pkg = ", ".join(
                c["client_info"]["android_client_info"]["package_name"]
                for c in data.get("client", [])
            )
            return data["project_info"]["project_id"], pkg
        data = plistlib.loads(path.read_bytes())
        return data.get("PROJECT_ID"), data.get("BUNDLE_ID")
    except Exception:  # noqa: BLE001
        return None, None


def main() -> int:
    parser = argparse.ArgumentParser(description="FCM sozlamasini tekshirish")
    parser.add_argument("--user-id", type=int, help="Mijozga test push yuborish")
    parser.add_argument("--courier-id", type=int, help="Kuryerga test push yuborish")
    args = parser.parse_args()

    courier_app = fcm._courier_app()
    customer_app = fcm._customer_app()

    print("── Firebase loyihalari ──")
    if courier_app is None:
        print("  kuryer : SOZLANMAGAN (FIREBASE_CREDENTIALS_JSON/PATH bo'sh)")
    else:
        print(f"  kuryer : {_project_of(courier_app)}")
    if customer_app is None:
        print("  mijoz  : SOZLANMAGAN")
    elif customer_app is courier_app:
        print(f"  mijoz  : {_project_of(customer_app)}  (kuryer bilan bir xil)")
    else:
        print(f"  mijoz  : {_project_of(customer_app)}  (alohida kalit)")

    expected = {
        "kuryer": _project_of(courier_app) if courier_app else None,
        "mijoz": _project_of(customer_app) if customer_app else None,
    }

    print()
    print("── Ilova konfiguratsiyalari ──")
    mismatched = False
    for label, rel, kind, target in _APP_CONFIGS:
        path = REPO / rel
        if not path.exists():
            print(f"  {label:15s}: fayl yo'q ({rel})")
            continue
        project, ident = _read_app_project(path, kind)
        if project is None:
            print(f"  {label:15s}: o'qib bo'lmadi ({rel})")
            continue
        want = expected.get(target)
        if want and project != want:
            mismatched = True
            mark = f"XATO — server '{want}' nomidan yuboradi"
        elif want:
            mark = "OK"
        else:
            mark = "server tomoni sozlanmagan"
        print(f"  {label:15s}: {project:24s} [{ident}] → {mark}")

    if mismatched:
        print()
        print("  ⚠️  Loyiha mos emas — push HECH QACHON yetib bormaydi.")
        print("  Ikki yo'ldan biri:")
        print("   1) Firebase Console'da SERVER loyihasini oching → Project")
        print("      settings → Your apps → shu ilovani tanlang →")
        print("      google-services.json / GoogleService-Info.plist ni yuklab")
        print("      olib, ilova papkasiga qo'ying va qayta build qiling.")
        print("   2) Yoki ilova loyihasining service account kalitini olib,")
        print("      FIREBASE_CUSTOMER_CREDENTIALS_PATH ga ko'rsating —")
        print("      ilovani qayta chiqarish shart emas.")

    print()
    print("── Token holati ──")
    # Baza yo'q bo'lsa ham yuqoridagi eng muhim tekshiruv ko'rinib qolsin.
    try:
        with SessionLocal() as db:
            users_with = db.scalar(
                select(User).where(User.fcm_token.is_not(None)).limit(1)
            )
            couriers_with = db.scalar(
                select(AdminUser).where(AdminUser.fcm_token.is_not(None)).limit(1)
            )
        print(f"  fcm_token bor mijoz  : {'bor' if users_with else 'YO\'Q'}")
        print(f"  fcm_token bor kuryer : {'bor' if couriers_with else 'YO\'Q'}")
        if not users_with:
            print("  → Mijoz ilovaga kirib, bildirishnomaga ruxsat bersa token yoziladi.")
    except Exception as e:  # noqa: BLE001
        print(f"  bazaga ulanib bo'lmadi ({type(e).__name__}) — o'tkazib yuborildi")

    if args.user_id:
        print()
        print(f"── Test push → mijoz #{args.user_id} ──")
        fcm.notify_user(args.user_id, "Test", "Bu sinov bildirishnomasi", url="/")
        print("  Yuborildi (log'da xato bormi — tekshiring).")

    if args.courier_id:
        print()
        print(f"── Test push → kuryer #{args.courier_id} ──")
        fcm.notify_courier(args.courier_id, "Test", "Bu sinov bildirishnomasi")
        print("  Yuborildi (log'da xato bormi — tekshiring).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
