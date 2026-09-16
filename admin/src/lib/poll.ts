// Davriy yangilash. Sahifa yashirin bo'lsa yoki oldingi so'rov hali tugamagan
// bo'lsa o'tkazib yuboradi: server sekinlashganda so'rovlar ustma-ust
// yig'ilib, yukni o'zi ko'paytirmasin (2026-09-16 hodisasi).
export function poll(fn: () => Promise<unknown>, ms: number): () => void {
  let busy = false;
  const id = setInterval(async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      await fn();
    } catch {
      // fn o'zi xatoni ko'rsatadi
    } finally {
      busy = false;
    }
  }, ms);
  return () => clearInterval(id);
}
