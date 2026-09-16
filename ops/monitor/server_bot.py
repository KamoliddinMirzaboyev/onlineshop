#!/usr/bin/env python3
"""Barakali Bozor — server monitor + Telegram status bot.

- Reply keyboard: "📊 Server holati" → full CPU/RAM/disk/docker/API report
- Background checks: API, containers, disk, RAM — state-change alerts only
Only responds to BACKUP_TG_CHAT_ID (whitelist).
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_FILE = Path(os.environ.get("BACKUP_ENV", "/opt/allfoods/backup.env"))
STATE_FILE = Path("/opt/allfoods/monitor/alert_state.json")
OFFSET_FILE = Path("/opt/allfoods/monitor/update_offset")
CHECK_INTERVAL = 60  # seconds between health checks
LOAD_PER_CORE_ALERT = 3.0  # normal ~0.1-0.5; 2026-09-16 hodisasida 8-17 edi
POLL_TIMEOUT = 25  # long-poll seconds
BTN = "📊 Server holati"


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        raise SystemExit(f"env not found: {path}")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


ENV = load_env(ENV_FILE)
TOKEN = ENV["BACKUP_TG_TOKEN"]
CHAT_ID = int(ENV["BACKUP_TG_CHAT_ID"])
API = f"https://api.telegram.org/bot{TOKEN}"
CONTAINERS = [
    "allfoods-api-1",
    "allfoods-bot-1",
    "allfoods-postgres-1",
    "allfoods-redis-1",
]


def tg(method: str, payload: dict | None = None, timeout: int = 60) -> dict:
    url = f"{API}/{method}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {body}"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


def send_message(text: str, chat_id: int = CHAT_ID, with_keyboard: bool = True) -> None:
    payload: dict = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    if with_keyboard:
        payload["reply_markup"] = {
            "keyboard": [[{ "text": BTN }]],
            "resize_keyboard": True,
            "is_persistent": True,
        }
    tg("sendMessage", payload)


def sh(cmd: str, timeout: int = 15) -> str:
    try:
        r = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return (r.stdout or "").strip()
    except Exception as e:  # noqa: BLE001
        return f"err:{e}"


def read_mem() -> tuple[float, float, float]:
    """Return total_mb, used_mb, available_mb."""
    info = {}
    with open("/proc/meminfo", encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 2:
                info[parts[0].rstrip(":")] = int(parts[1])  # kB
    total = info.get("MemTotal", 0) / 1024
    avail = info.get("MemAvailable", 0) / 1024
    used = total - avail
    return total, used, avail


def read_load() -> str:
    with open("/proc/loadavg", encoding="utf-8") as f:
        a, b, c, *_ = f.read().split()
    return f"{a} {b} {c}"


def cpu_percent(sample: float = 0.4) -> float:
    def snap() -> tuple[int, int]:
        with open("/proc/stat", encoding="utf-8") as f:
            parts = f.readline().split()
        vals = list(map(int, parts[1:]))
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
        total = sum(vals)
        return idle, total

    i1, t1 = snap()
    time.sleep(sample)
    i2, t2 = snap()
    di, dt = i2 - i1, t2 - t1
    if dt <= 0:
        return 0.0
    return max(0.0, min(100.0, (1.0 - di / dt) * 100.0))


def disk_use(path: str = "/") -> tuple[str, int]:
    """Return human line and percent int."""
    st = os.statvfs(path)
    total = st.f_frsize * st.f_blocks
    free = st.f_frsize * st.f_bavail
    used = total - free
    pct = int(round(used * 100 / total)) if total else 0
    def gb(n: int) -> str:
        return f"{n / (1024**3):.1f}G"
    return f"{gb(used)}/{gb(total)} ({pct}%)", pct


def container_status() -> dict[str, str] | None:
    """None — docker CLI o'zi javob bermadi. Server CPU/disk bo'g'ilganda
    `docker ps` osilib qoladi; avval bu 4 ta soxta "NOT FOUND" bo'lib chiqardi."""
    out: dict[str, str] = {}
    raw = sh("docker ps -a --format '{{.Names}}|{{.Status}}'", timeout=30)
    if raw.startswith("err:"):
        return None
    lines = {ln.split("|", 1)[0]: ln.split("|", 1)[1] for ln in raw.splitlines() if "|" in ln}
    for name in CONTAINERS:
        out[name] = lines.get(name, "NOT FOUND")
    return out


def api_health() -> tuple[bool, str]:
    try:
        req = urllib.request.Request("http://127.0.0.1:18081/health", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode()
            ok = resp.status == 200 and "ok" in body.lower()
            return ok, body[:80]
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:80]


# Kernel "server qotdi" belgilari: vCPU ishlamay qolgani (soft lockup, RCU
# stall) yoki disk IO osilgani (hung task). 2026-09-16: Contabo host diski
# fstrim discard'da 100+ s qotdi — CPU/RAM/disk % hammasi "normal" ko'rinardi.
STALL_RE = "soft lockup|self-detected stall|rcu_preempt kthread|blocked for more than"


def kernel_stalls() -> int:
    out = sh(
        f"journalctl -k -q --no-pager --since -{CHECK_INTERVAL * 3}s | grep -cE '{STALL_RE}'",
        timeout=20,
    )
    try:
        return int(out)
    except ValueError:
        return 0


def load_per_core() -> float:
    return os.getloadavg()[0] / (os.cpu_count() or 1)


def uptime_human() -> str:
    return sh("uptime -p") or "?"


def build_report() -> str:
    host = socket.gethostname()
    cpu = cpu_percent()
    total, used, avail = read_mem()
    mem_pct = (used / total * 100) if total else 0
    disk_line, disk_pct = disk_use("/")
    load = read_load()
    api_ok, api_body = api_health()
    boxes = container_status()
    lines = [
        f"🖥 Server holati — {host}",
        f"⏰ {time.strftime('%Y-%m-%d %H:%M:%S %Z')}",
        f"⏱ Uptime: {uptime_human()}",
        "",
        f"🧮 CPU: {cpu:.0f}%",
        f"📊 Load: {load}",
        f"🧠 RAM: {used:.0f}/{total:.0f} MB ({mem_pct:.0f}%) — free {avail:.0f} MB",
        f"💾 Disk /: {disk_line}",
        "",
        f"🔌 API: {'✅ OK' if api_ok else '❌ DOWN'} ({api_body})",
        "🐳 Docker:",
    ]
    if boxes is None:
        lines.append("  ⏳ docker javob bermadi (server bo'g'ilgan)")
    else:
        for name, st in boxes.items():
            short = name.replace("allfoods-", "").replace("-1", "")
            icon = "✅" if st.lower().startswith("up") else "❌"
            lines.append(f"  {icon} {short}: {st}")
    # problems summary
    problems = collect_problems(cpu, mem_pct, disk_pct, api_ok, boxes, load_per_core(), kernel_stalls())
    lines.append("")
    if problems:
        lines.append("⚠️ Muammolar:")
        for p in problems:
            lines.append(f"  • {p}")
    else:
        lines.append("✅ Jiddiy muammo topilmadi")
    return "\n".join(lines)


def collect_problems(
    cpu: float,
    mem_pct: float,
    disk_pct: int,
    api_ok: bool,
    boxes: dict[str, str] | None,
    load_core: float = 0.0,
    stalls: int = 0,
) -> list[str]:
    problems: list[str] = []
    if stalls:
        problems.append(
            f"Kernel qotishi ({stalls} ta soft lockup/IO stall) — Contabo host "
            "disk/CPU muammosi ehtimoli katta"
        )
    if load_core >= LOAD_PER_CORE_ALERT:
        problems.append(f"Load juda yuqori: {load_core:.1f}/yadro ({read_load()})")
    if not api_ok:
        problems.append("API javob bermayapti (/health)")
    if boxes is None:
        problems.append("Docker javob bermayapti (konteynerlar holati noma'lum)")
    else:
        for name, st in boxes.items():
            if not st.lower().startswith("up"):
                problems.append(f"Container ishlamayapti: {name} ({st})")
    if disk_pct >= 90:
        problems.append(f"Disk deyarli to'la: {disk_pct}%")
    elif disk_pct >= 85:
        problems.append(f"Disk yuqori: {disk_pct}%")
    if mem_pct >= 92:
        problems.append(f"RAM deyarli to'la: {mem_pct:.0f}%")
    elif mem_pct >= 88:
        problems.append(f"RAM yuqori: {mem_pct:.0f}%")
    if cpu >= 95:
        problems.append(f"CPU juda yuqori: {cpu:.0f}%")
    return problems


def current_alert_keys() -> set[str]:
    cpu = cpu_percent(0.2)
    total, used, _ = read_mem()
    mem_pct = (used / total * 100) if total else 0
    _, disk_pct = disk_use("/")
    api_ok, _ = api_health()
    boxes = container_status()
    keys: set[str] = set()
    if kernel_stalls():
        keys.add("host_stall")
    if load_per_core() >= LOAD_PER_CORE_ALERT:
        keys.add("load_high")
    if not api_ok:
        keys.add("api_down")
    if boxes is None:
        keys.add("docker_unresponsive")
    else:
        for name, st in boxes.items():
            if not st.lower().startswith("up"):
                keys.add(f"ctr:{name}")
    if disk_pct >= 85:
        keys.add(f"disk:{disk_pct//5*5}")  # bucket
    if mem_pct >= 88:
        keys.add("ram_high")
    if cpu >= 95:
        keys.add("cpu_high")
    return keys


def load_state() -> set[str]:
    if not STATE_FILE.is_file():
        return set()
    try:
        data = json.loads(STATE_FILE.read_text())
        return set(data.get("active", []))
    except Exception:  # noqa: BLE001
        return set()


def save_state(active: set[str]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"active": sorted(active), "ts": time.time()}))


_strikes: dict[str, int] = {}
STRIKE_THRESHOLD = 2  # consecutive 60s checks a problem must persist before alerting
                       # (1 martalik qisqa tebranish alert bo'lmasin)


def check_and_alert() -> None:
    raw = current_alert_keys()
    for k in raw:
        _strikes[k] = _strikes.get(k, 0) + 1
    for k in list(_strikes):
        if k not in raw:
            del _strikes[k]
    now = {k for k, n in _strikes.items() if n >= STRIKE_THRESHOLD}
    prev = load_state()
    new = now - prev
    resolved = prev - now
    if new:
        # build human messages
        cpu = cpu_percent(0.15)
        total, used, avail = read_mem()
        mem_pct = (used / total * 100) if total else 0
        disk_line, disk_pct = disk_use("/")
        api_ok, api_body = api_health()
        boxes = container_status()
        problems = collect_problems(
            cpu, mem_pct, disk_pct, api_ok, boxes, load_per_core(), kernel_stalls()
        )
        msg = (
            "🚨 SERVER MUAMMO\n"
            f"Time: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}\n\n"
            + "\n".join(f"• {p}" for p in problems)
            + f"\n\nCPU {cpu:.0f}% | RAM {mem_pct:.0f}% | Disk {disk_pct}%\n"
            f"API: {'OK' if api_ok else 'DOWN'} ({api_body})"
        )
        send_message(msg)
    if resolved and not new:
        send_message(
            f"✅ Muammo bartaraf\n"
            f"Time: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}\n"
            f"Yechilgan: {', '.join(sorted(resolved))}\n"
            f"Hozir: hammasi normal ko'rinadi"
        )
    elif resolved and new:
        # mixed — status already sent in new; still ok
        pass
    save_state(now)


def load_offset() -> int | None:
    if not OFFSET_FILE.is_file():
        return None
    try:
        return int(OFFSET_FILE.read_text().strip())
    except Exception:  # noqa: BLE001
        return None


def save_offset(n: int) -> None:
    OFFSET_FILE.write_text(str(n))


def handle_update(upd: dict) -> None:
    msg = upd.get("message") or upd.get("edited_message")
    if not msg:
        return
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id != CHAT_ID:
        # ignore strangers
        if chat_id:
            tg(
                "sendMessage",
                {
                    "chat_id": chat_id,
                    "text": "⛔ Ruxsat yo'q.",
                },
            )
        return
    text = (msg.get("text") or "").strip()
    if text in ("/start", "/help"):
        send_message(
            "Salom! Men server monitor botiman.\n\n"
            f"«{BTN}» — CPU, RAM, disk, Docker, API holati.\n"
            "Muammo bo'lsa o'zim yozaman (API, container, disk, RAM, load, kernel qotishi)."
        )
        return
    if text == BTN or text in ("/status", "/holat", "status"):
        send_message(build_report())
        return
    # any other text → hint
    send_message(f"Tugmani bosing: {BTN}\nYoki /status")


def poll_once() -> None:
    offset = load_offset()
    params: dict = {"timeout": POLL_TIMEOUT, "allowed_updates": ["message"]}
    if offset is not None:
        params["offset"] = offset
    # long poll via GET query
    q = urllib.parse.urlencode(
        {k: (json.dumps(v) if isinstance(v, list) else v) for k, v in params.items()}
    )
    url = f"{API}/getUpdates?{q}"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=POLL_TIMEOUT + 10) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return
    if not data.get("ok"):
        return
    for upd in data.get("result") or []:
        uid = upd.get("update_id")
        if uid is not None:
            save_offset(uid + 1)
        try:
            handle_update(upd)
        except Exception as e:  # noqa: BLE001
            try:
                send_message(f"Bot xato: {e}")
            except Exception:
                pass


def main() -> None:
    # drop pending spam on start? keep offset
    send_message(
        "✅ Server monitor yoqildi.\n"
        f"Tugma: {BTN}\n"
        f"Tekshiruv har {CHECK_INTERVAL}s. Muammo bo'lsa darhol xabar."
    )
    last_check = 0.0
    while True:
        now = time.time()
        if now - last_check >= CHECK_INTERVAL:
            try:
                check_and_alert()
            except Exception as e:  # noqa: BLE001
                try:
                    send_message(f"⚠️ Monitor check xato: {e}")
                except Exception:
                    pass
            last_check = time.time()
        poll_once()


if __name__ == "__main__":
    main()
