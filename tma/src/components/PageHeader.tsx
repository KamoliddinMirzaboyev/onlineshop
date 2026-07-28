import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { goBack } from "../lib/navBack";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
}

/** Barcha asosiy sahifalar uchun brand yashil banner. */
export default function PageHeader({ title, subtitle, back }: Props) {
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="sticky top-0 z-20 bg-brand text-white rounded-b-2xl shadow-sm px-4 py-4 flex items-center gap-3">
      {back && (
        <button
          type="button"
          onClick={() => goBack(nav, pathname)}
          className="h-9 w-9 shrink-0 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition"
          aria-label="Orqaga"
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
