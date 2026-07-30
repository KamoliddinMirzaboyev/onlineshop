import { CheckCircle2, ImagePlus, Loader2, RefreshCw, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { uploadImage } from "../api";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Preview balandligi (Tailwind), masalan "h-24" yoki "h-32". */
  heightClass?: string;
  label?: string;
  /** Max fayl hajmi (MB). Default 8. */
  maxMb?: number;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/*";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Professional rasm uploader:
 * - drag & drop
 * - lokal preview
 * - foizli progress
 * - aniq holatlar (yuklanmoqda / tayyor / xato)
 */
export default function ImageUpload({
  value,
  onChange,
  heightClass = "h-36",
  label = "Rasm",
  maxMb = 8,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [doneFlash, setDoneFlash] = useState(false);

  // Object URL tozalash
  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const clearLocal = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName(null);
    setProgress(0);
  };

  const validate = (file: File): string | null => {
    if (!file.type.startsWith("image/")) return "Faqat rasm fayli (JPG, PNG, WebP…)";
    if (file.size > maxMb * 1024 * 1024) {
      return `Fayl juda katta (max ${maxMb} MB). Hozir: ${formatBytes(file.size)}`;
    }
    return null;
  };

  const pick = async (file?: File | null) => {
    if (!file || busy) return;
    const v = validate(file);
    if (v) {
      setErr(v);
      return;
    }

    setErr(null);
    setDoneFlash(false);
    setBusy(true);
    setProgress(0);
    setFileName(file.name);

    const local = URL.createObjectURL(file);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(local);

    try {
      const url = await uploadImage(file, setProgress);
      onChange(url);
      setDoneFlash(true);
      window.setTimeout(() => setDoneFlash(false), 1600);
      // Server URL kelgach lokal blob kerak emas
      URL.revokeObjectURL(local);
      setPreview(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 120) : "Yuklashda xatolik");
      clearLocal();
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    void pick(file);
  };

  const openPicker = () => {
    if (!busy) inputRef.current?.click();
  };

  const showSrc = value || preview;
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        {busy && (
          <span className="text-[11px] font-semibold tabular-nums text-brand">
            {pct}%
          </span>
        )}
        {doneFlash && !busy && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <CheckCircle2 size={13} /> Yuklandi
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {showSrc ? (
        <div
          className={`relative mt-0.5 group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${heightClass}`}
        >
          <img
            src={showSrc}
            alt=""
            className="h-full w-full object-cover"
          />

          {/* Upload overlay + progress */}
          {busy && (
            <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 px-4">
              <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-white" />
              </div>
              <p className="text-white text-sm font-semibold">Yuklanmoqda…</p>
              {fileName && (
                <p className="text-white/75 text-[11px] truncate max-w-full px-2">
                  {fileName}
                </p>
              )}
              <div className="w-full max-w-[220px] mt-1">
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-150 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-center text-white text-xs font-bold tabular-nums mt-1.5">
                  {pct}%
                </p>
              </div>
            </div>
          )}

          {!busy && (
            <>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  clearLocal();
                  setErr(null);
                }}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-slate-900/65 text-white flex items-center justify-center hover:bg-slate-900/85 transition shadow-sm"
                title="O'chirish"
              >
                <X size={15} />
              </button>
              <button
                type="button"
                onClick={openPicker}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 text-xs font-medium bg-white/95 text-slate-700 rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-200/80 hover:bg-white transition"
              >
                <RefreshCw size={13} />
                O&apos;zgartirish
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
          className={[
            heightClass,
            "mt-0.5 w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition select-none",
            dragOver
              ? "border-brand bg-brand/5 text-brand scale-[1.01]"
              : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-brand/60 text-slate-500",
            "disabled:opacity-60 disabled:pointer-events-none",
          ].join(" ")}
        >
          <span
            className={[
              "h-11 w-11 rounded-full flex items-center justify-center",
              dragOver ? "bg-brand/15 text-brand" : "bg-white text-slate-500 shadow-sm border border-slate-200/80",
            ].join(" ")}
          >
            {dragOver ? <UploadCloud size={22} /> : <ImagePlus size={22} />}
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {dragOver ? "Qo'yib yuboring" : "Rasm tanlash yoki sudrab tashlang"}
          </span>
          <span className="text-[11px] text-slate-400">
            JPG, PNG, WebP · max {maxMb} MB
          </span>
        </button>
      )}

      {err && (
        <p className="text-xs text-rose-600 mt-1.5 flex items-start gap-1">
          <span className="font-medium shrink-0">Xato:</span>
          <span className="break-all">{err}</span>
        </p>
      )}
    </div>
  );
}
