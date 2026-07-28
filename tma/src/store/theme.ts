// Faqat yorug' mavzu — tungi rejim olib tashlangan.
const KEY = "af_theme";

document.documentElement.setAttribute("data-theme", "light");
try {
  localStorage.removeItem(KEY);
} catch {
  /* ignore */
}
