import { Phone, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useI18n } from "../i18n";

export default function ContactPage() {
  const { lang } = useI18n();
  const [phones, setPhones] = useState<string[]>([]);
  const [telegram, setTelegram] = useState<string | null>(null);

  useEffect(() => {
    api.store().then((s) => {
      setPhones((s?.phones ?? []).slice(0, 2));
      setTelegram(s?.socials?.telegram?.replace(/^@/, "") || null);
    }).catch(() => {});
  }, []);

  const empty = phones.length === 0 && !telegram;

  return (
    <div className="min-h-full bg-tg-bg pb-8">
      <PageHeader title={lang === "uz" ? "Adminga bog'lanish" : "Связаться с админом"} back />

      <div className="mx-4 mt-6 card divide-y divide-black/5">
        {phones.map((p) => (
          <a key={p} href={`tel:${p}`} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <Phone size={17} className="text-tg-hint" />
            {lang === "uz" ? "Qo'ng'iroq" : "Звонок"}
            <span className="ml-auto text-tg-hint text-sm">{p}</span>
          </a>
        ))}
        {telegram && (
          <a
            href={`https://t.me/${telegram}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          >
            <Send size={17} className="text-tg-hint" />
            Telegram
            <span className="ml-auto text-brand text-sm font-medium">@{telegram}</span>
          </a>
        )}
        {empty && (
          <p className="px-4 py-6 text-center text-sm text-tg-hint">
            {lang === "uz" ? "Bog'lanish ma'lumoti kiritilmagan" : "Контакты не указаны"}
          </p>
        )}
      </div>
    </div>
  );
}
