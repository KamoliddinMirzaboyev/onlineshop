export function money(value: number): string {
  return value.toLocaleString("ru-RU").replace(/,/g, " ");
}

// Ruscha qisqartmalar — birlik uz tilida saqlanadi (kg/dona/litr/gramm).
const RU_UNIT: Record<string, string> = {
  dona: "шт",
  kg: "кг",
  litr: "л",
  gramm: "г",
  bog: "пуч.",
};

/** O'lchov birligi yorlig'i (til bo'yicha). */
export function unitLabel(unit?: string | null, lang = "uz"): string {
  if (!unit) return "";
  return lang === "ru" ? RU_UNIT[unit] ?? unit : unit;
}

/** Stepperda +/- necha birlikka o'zgarishi — kg/litrda 0.5 (1.5 kg un ham
 * buyurtma qilish mumkin), dona kabi sanoq birliklarda 1. */
export function qtyStep(unit?: string | null): number {
  return unit === "kg" || unit === "litr" ? 0.5 : 1;
}

/** "1", "1.5" — butun sonda "1", kasrda bitta kasr xona. */
export function fmtQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
}

/** Miqdor + o'lchov birligi: "2 kg", "3 dona". Birlik bo'lmasa faqat son. */
export function qtyUnit(quantity: number, unit?: string | null, lang = "uz"): string {
  const u = unitLabel(unit, lang);
  return u ? `${fmtQty(quantity)} ${u}` : fmtQty(quantity);
}

/** O'zbek raqamini "+998 88 888 88 88" ko'rinishiga keltiradi.
 *  Bo'sh kiritma — bo'sh qatlam (placeholder ko'rinishi uchun). */
export function formatUzPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return "";
  const parts = ["+998"];
  if (d.length > 0) parts.push(d.slice(0, 2));
  if (d.length > 2) parts.push(d.slice(2, 5));
  if (d.length > 5) parts.push(d.slice(5, 7));
  if (d.length > 7) parts.push(d.slice(7, 9));
  return parts.join(" ");
}
