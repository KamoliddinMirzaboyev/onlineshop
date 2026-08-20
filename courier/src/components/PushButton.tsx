import { Bell, BellOff, BellRing, Share, Send } from "lucide-react";
import { useEffect, useState } from "react";
import {
  enablePush,
  isIOS,
  isStandalone,
  notifPermission,
  pushSupported,
  testPush,
} from "../push";

export default function PushButton() {
  const [perm, setPerm] = useState<NotificationPermission>(notifPermission());
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPerm(notifPermission());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  if (isIOS() && !isStandalone()) {
    return (
      <div className="py-3 text-sm text-slate-500 flex items-start gap-2">
        <Share size={16} className="shrink-0 mt-0.5 text-brand" />
        <span>
          Bildirishnoma olish uchun: <b>Share</b> → <b>"Add to Home Screen"</b> orqali
          o&apos;rnating, keyin qayta oching.
        </span>
      </div>
    );
  }

  if (!pushSupported()) {
    return (
      <div className="py-3 text-sm text-slate-400 text-center">
        Bu brauzer push bildirishnomani qo&apos;llab-quvvatlamaydi
      </div>
    );
  }

  if (perm === "granted") {
    return (
      <div className="py-2 space-y-2">
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-600 font-medium">
          <BellRing size={16} /> Bildirishnoma yoniq
        </div>
        <button
          type="button"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            setTestMsg(null);
            try {
              // Subscribe yangilab, test yuborish
              await enablePush();
              await testPush();
              setTestMsg("Test yuborildi — bildirishnoma kelishi kerak");
            } catch {
              setTestMsg("Test muvaffaqiyatsiz — qayta urinib ko'ring");
            } finally {
              setTesting(false);
            }
          }}
          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
        >
          <Send size={15} /> {testing ? "Yuborilmoqda…" : "Test bildirishnoma"}
        </button>
        {testMsg && (
          <p className="text-xs text-center text-slate-500">{testMsg}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy || perm === "denied"}
        onClick={async () => {
          setBusy(true);
          setErr(false);
          try {
            setPerm(await enablePush());
          } catch {
            setErr(true);
            setPerm(notifPermission());
          } finally {
            setBusy(false);
          }
        }}
        className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
      >
        {perm === "denied" ? <BellOff size={16} /> : <Bell size={16} />}
        {perm === "denied"
          ? "Bloklangan — brauzer sozlamalaridan yoqing"
          : busy
            ? "..."
            : "Bildirishnomani yoqish"}
      </button>
      {err && (
        <p className="pt-1 text-xs text-red-500 text-center">
          Yoqib bo&apos;lmadi — HTTPS va brauzer ruxsatini tekshiring
        </p>
      )}
    </div>
  );
}
