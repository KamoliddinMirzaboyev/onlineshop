import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
}

/** Barcha asosiy sahifalar (Bosh sahifa, Savat, Profil) uchun umumiy —
 * pastki burchaklari yumaloqlangan brand yashil banner. */
export default function PageHeader({ title, subtitle, back }: Props) {
  const nav = useNavigate();
  return (
    <div className="sticky top-0 z-20 bg-brand text-white rounded-b-2xl shadow-sm px-4 py-4 flex items-center gap-3">
      {back && (
        <button
          onClick={() => nav(-1)}
          className="h-9 w-9 shrink-0 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <h1 className="flex-1 text-center text-xl font-extrabold tracking-tight">
        {title}
        {subtitle && <span className="ml-2 text-sm font-normal opacity-85">{subtitle}</span>}
      </h1>
      {back && <span className="w-9 shrink-0" />}
    </div>
  );
}
