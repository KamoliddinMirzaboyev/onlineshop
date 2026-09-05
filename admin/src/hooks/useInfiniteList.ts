import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 12;

// Ro'yxatni 12 tadan ko'rsatadi; pastga scroll qilinganda yana 12 tasi qo'shiladi.
// resetKey o'zgarsa (qidiruv/filter), ro'yxat birinchi sahifaga qaytadi.
export function useInfiniteList<T>(items: T[], resetKey?: unknown) {
  const [count, setCount] = useState(PAGE_SIZE);
  useEffect(() => setCount(PAGE_SIZE), [resetKey]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setCount((c) => Math.min(c + PAGE_SIZE, items.length));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length]);

  return { visible: items.slice(0, count), sentinelRef, hasMore: count < items.length };
}
