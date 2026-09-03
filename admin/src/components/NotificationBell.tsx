import { Bell, CheckCircle2, PackageCheck, Pencil, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import type { NotificationEvent } from "../types";

const SEEN_KEY = "af_admin_notif_last_seen";

const ICON: Record<NotificationEvent["type"], typeof Bell> = {
  new: Sparkles,
  accepted: CheckCircle2,
  delivered: PackageCheck,
  adjusted: Pencil,
};

const LABEL: Record<NotificationEvent["type"], string> = {
  new: "Yangi buyurtma",
  accepted: "Kuryer qabul qildi",
  delivered: "Yetkazib berildi",
  adjusted: "Kuryer tahrirladi",
};

// Har hodisa uchun aniq izoh — "holati yangilandi" o'rniga.
const BODY: Record<NotificationEvent["type"], string> = {
  new: "Yangi buyurtma kelib tushdi",
  accepted: "Kuryer buyurtmani qabul qildi",
  delivered: "Buyurtma mijozga yetkazib berildi",
  adjusted: "Buyurtma tarkibi kuryer tomonidan o'zgartirildi",
};

// so'm formatlash: 45000 -> "45 000 so'm"
function money(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

// Vaqtni hh:mm shaklida qaytaradi
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// Sanani DD.MM.YYYY shaklida qaytaradi
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function NotificationBell() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(
    () => localStorage.getItem(SEEN_KEY) ?? new Date().toISOString(),
  );

  const load = async () => {
    try {
      setEvents(await get<NotificationEvent[]>("/admin/notifications"));
    } catch {
      // silent
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const unseen = events.filter((e) => e.at > lastSeen).length;

  const toggle = () => {
    if (!open && events.length) {
      const newest = events[0].at;
      setLastSeen(newest);
      localStorage.setItem(SEEN_KEY, newest);
    }
    setOpen(!open);
  };

  const markAllRead = () => {
    setLastSeen(new Date().toISOString());
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  };

  // Bildirishnomalarni sanaga ko'ra guruhlash
  const groupedEvents = events.reduce((acc, event) => {
    const dateStr = formatDate(event.at);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {} as Record<string, NotificationEvent[]>);

  return (
    <>
      <button
        className="icon-btn relative"
        onClick={toggle}
        aria-label="Bildirishnomalar"
      >
        <Bell size={20} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {/* OVERLAY */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} 
        onClick={() => setOpen(false)} 
      />

      {/* DRAWER */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[60] flex flex-col transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h2 className="text-xl font-bold text-slate-800">Bildirishnomalar</h2>
          <div className="flex items-center gap-2">
            <button onClick={markAllRead} className="text-sm font-medium text-brand hover:text-brand/80 transition-colors">
              Barchasini o'qish
            </button>
            <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
          {events.length === 0 ? (
            <div className="text-center text-slate-400 py-10 mt-10">
              <Bell size={32} className="mx-auto mb-4 opacity-20" />
              Hozircha faoliyat yo'q
            </div>
          ) : (
            Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="text-xs font-semibold text-slate-400 mb-4">{date}</div>
                <div className="space-y-5">
                  {dateEvents.map((e, i) => {
                    const Icon = ICON[e.type];
                    const isNew = e.at > lastSeen;
                    return (
                      <div key={`${e.order_id}-${e.type}-${i}`} className="flex items-start gap-4">
                        <div className="relative">
                          <span className={`grid place-items-center h-10 w-10 rounded-full shrink-0 ${isNew ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-500"}`}>
                            <Icon size={18} />
                          </span>
                          {isNew && <span className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 border-2 border-white rounded-full"></span>}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-sm font-medium truncate ${isNew ? "text-slate-900" : "text-slate-700"}`}>
                              № {e.order_number} · {LABEL[e.type]}
                            </h3>
                            <span className="text-xs text-slate-400 shrink-0 mt-0.5">{formatTime(e.at)}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5 leading-relaxed truncate">
                            {BODY[e.type]} · {money(e.total)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
