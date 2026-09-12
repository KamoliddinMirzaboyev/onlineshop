"""Ommaviy ofertani statik HTML sahifaga chiqaradi (`tma/public/terms.html`).

Manba — `app/bot/offer_text.py`: bot ham, sayt ham bitta matndan foydalanadi,
shunda ular bir-biridan uzoqlashib ketmaydi.

Oferta matni o'zgargach qayta ishga tushiring:
    python -m scripts.render_legal_pages
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from app.bot.offer_text import OFFER_RU, OFFER_UZ

OUT = Path(__file__).resolve().parents[2] / "tma" / "public" / "terms.html"

_HEAD = """<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Barakali Bozor — Ommaviy oferta</title>
  <meta name="description" content="Barakali Bozor ommaviy ofertasi — masofadan savdo va yetkazib berish shartlari." />
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
           max-width: 760px; margin: 0 auto; padding: 40px 20px 80px;
           line-height: 1.65; color: #0f172a; background: #fff; }
    h1 { color: #16a34a; font-size: 1.5rem; line-height: 1.25; }
    h2 { font-size: 1.05rem; margin-top: 1.8em; }
    .meta { color: #64748b; font-size: 0.9rem; }
    .lang { display: flex; gap: 8px; margin: 20px 0 28px; }
    .lang a { padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 999px;
              text-decoration: none; color: #0f172a; font-size: 0.9rem; }
    .lang a[aria-current="true"] { background: #16a34a; border-color: #16a34a; color: #fff; }
    section[hidden] { display: none; }
    a { color: #15803d; }
  </style>
</head>
<body>
  <div class="lang">
    <a href="#uz" id="tab-uz" aria-current="true">O‘zbekcha</a>
    <a href="#ru" id="tab-ru">Русский</a>
  </div>
"""

_TAIL = """
  <script>
    function show() {
      var ru = location.hash === "#ru";
      document.getElementById("uz").hidden = ru;
      document.getElementById("ru").hidden = !ru;
      document.getElementById("tab-uz").setAttribute("aria-current", String(!ru));
      document.getElementById("tab-ru").setAttribute("aria-current", String(ru));
    }
    window.addEventListener("hashchange", show);
    show();
  </script>
</body>
</html>
"""


def _to_html(text: str) -> str:
    """Telegram HTML (b/i) → sahifa uchun paragraf va sarlavhalar."""
    out: list[str] = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        # "<b>1. UMUMIY QOIDALAR</b>" kabi bo'limlar — sarlavha
        m = re.fullmatch(r"<b>(.+?)</b>", line)
        if m and not m.group(1).startswith("📄"):
            out.append(f"    <h2>{m.group(1)}</h2>")
            continue
        if line.startswith("📄"):
            out.append(f"    <h1>{re.sub(r'</?b>', '', line)}</h1>")
            continue
        if line.startswith("<i>") and line.endswith("</i>"):
            out.append(f'    <p class="meta">{line[3:-4]}</p>')
            continue
        out.append(f"    <p>{line}</p>")
    return "\n".join(out)


def render() -> str:
    return (
        _HEAD
        + '  <section id="uz">\n' + _to_html(OFFER_UZ) + "\n  </section>\n"
        + '  <section id="ru" hidden>\n' + _to_html(OFFER_RU) + "\n  </section>\n"
        + _TAIL
    )


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(), encoding="utf-8")
    print(f"yozildi: {OUT} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
