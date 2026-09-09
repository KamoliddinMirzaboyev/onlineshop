// Katta summalarni ixcham ko'rsatish: 12 500 000 -> "12,5 mln".
// Telefondagi yarim ekranli stat kartaga bir qatorga sig'adi.
export function sumShort(n?: number | null): string {
  const num = n || 0;
  const sign = num < 0 ? "-" : "";
  const v = Math.abs(num);
  if (v >= 1e9) return sign + trim(v / 1e9) + " mlrd";
  if (v >= 1e6) return sign + trim(v / 1e6) + " mln";
  if (v >= 1e3) return sign + trim(v / 1e3) + " ming";
  return sign + Math.round(v).toString();
}

// 1 xona kasr, butun bo'lsa kasrsiz: 12 -> "12", 12.53 -> "12,5"
function trim(x: number): string {
  return x.toFixed(1).replace(/\.0$/, "").replace(".", ",");
}

// To'liq ko'rinish — title/tooltip uchun: "12 500 000 so'm"
export function sumFull(n?: number | null): string {
  return (n || 0).toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
}

// ponytail: bu app'da test-runner yo'q (courier'da bor). Formatter oddiy,
// alohida vitest sozlash — keraksiz. Qo'shilsa: trim/sign/1e9 chegaralarini tekshir.
