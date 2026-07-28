import { SOFT_CATEGORY_COLORS } from "../lib/softColors";

interface Props {
  value: string | null | undefined;
  onChange: (hex: string) => void;
}

/** 30 ta yumshoq pastel rang — kategoriya foni uchun. */
export default function ColorPicker({ value, onChange }: Props) {
  const selected = value && SOFT_CATEGORY_COLORS.includes(value) ? value : null;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">Fon rangi</label>
      <div className="grid grid-cols-10 gap-2">
        {SOFT_CATEGORY_COLORS.map((hex) => {
          const active = selected === hex;
          return (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => onChange(hex)}
              className={`h-8 w-full rounded-lg border-2 transition ${
                active
                  ? "border-brand ring-2 ring-brand/30 scale-105"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              style={{ backgroundColor: hex }}
              aria-label={hex}
              aria-pressed={active}
            />
          );
        })}
      </div>
      {selected && (
        <p className="text-xs text-slate-400 mt-1.5">
          Tanlangan: <span className="font-mono">{selected}</span>
        </p>
      )}
    </div>
  );
}
