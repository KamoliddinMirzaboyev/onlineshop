import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  getLastLocationIssue,
  LocationIssue,
  OutOfRangeError,
  retryCoordsIfPreviouslyFailed,
} from "../api/client";
import type { RestaurantDetail } from "../api/types";

// ── Modul-darajadagi kesh ──────────────────────────────────────────
// Home/Category/Search har biri useStore chaqiradi. Sessiya davomida
// bitta muvaffaqiyatli natija; sahifa o'tganda darhol kesh.

type Snapshot = {
  store: RestaurantDetail | null;
  error: boolean;
  outOfRange: boolean;
  needsLocation: boolean;
  locationIssue: LocationIssue | null;
};

let cache: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
let fetchGen = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function fetchStore(force = false, forceCoords = false): Promise<Snapshot> {
  if (!force && cache && !cache.error && cache.store) {
    return cache;
  }
  if (!force && inflight) return inflight;

  const gen = ++fetchGen;
  inflight = (async () => {
    const next: Snapshot = {
      store: null,
      error: false,
      outOfRange: false,
      needsLocation: false,
      locationIssue: null,
    };
    try {
      next.store = await api.store({ forceCoords });
      next.locationIssue = getLastLocationIssue();
    } catch (e) {
      if (e instanceof OutOfRangeError) next.outOfRange = true;
      else next.error = true;
    }
    // Faqat eng so'nggi so'rov keshga yoziladi.
    if (gen === fetchGen) {
      cache = next;
      inflight = null;
      notify();
    }
    return next;
  })();

  return inflight;
}

/** Faol do'konni yuklaydi. Joylashuv bo'lmasa ham default do'kon ochiladi.
 * GPS yoqib qaytganda avtomatik qayta so'raladi (pageshow/visibility). */
export function useStore() {
  const [snap, setSnap] = useState<Snapshot>(
    () =>
      cache ?? {
        store: null,
        error: false,
        outOfRange: false,
        needsLocation: false,
        locationIssue: null,
      },
  );
  const [loading, setLoading] = useState(!cache || !!inflight);
  const retryingRef = useRef(false);

  useEffect(() => {
    const onChange = () => {
      if (cache) {
        setSnap(cache);
        setLoading(false);
      }
    };
    listeners.add(onChange);

    if (cache && !cache.error && cache.store) {
      setSnap(cache);
      setLoading(false);
    } else {
      setLoading(true);
      fetchStore().then((s) => {
        setSnap(s);
        setLoading(false);
      });
    }

    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const retry = useCallback((forceCoords = true) => {
    retryCoordsIfPreviouslyFailed();
    // Force coords re-fetch even if previous was "success" null.
    cache = null;
    setLoading(true);
    fetchStore(true, forceCoords).then((s) => {
      setSnap(s);
      setLoading(false);
    });
  }, []);

  // GPS yoqib sozlamalardan qaytganda — avtomatik qayta aniqlash.
  // Telegram WebView ba'zan visibilitychange bermaydi → pageshow + kechiktirilgan urinishlar.
  useEffect(() => {
    const timers: number[] = [];
    let cancelled = false;

    const scheduleRetries = () => {
      if (retryingRef.current) return;
      retryingRef.current = true;

      // GPS yoqilishi biroz kechikishi mumkin
      const gaps = [0, 700, 1200, 2000];
      let i = 0;

      const run = () => {
        if (cancelled) {
          retryingRef.current = false;
          return;
        }
        retryCoordsIfPreviouslyFailed();
        // Fonda jim yangilash — mavjud ma'lumot ekranda qoladi, skeleton ko'rsatilmaydi.
        fetchStore(true, true).then((s) => {
          if (cancelled) return;
          setSnap(s);
          setLoading(false);
          // Joylashuv muvaffaqiyatli bo'lsa to'xtaymiz; aks holda keyingi urinish.
          const issue = getLastLocationIssue();
          if (!issue) {
            retryingRef.current = false;
            return;
          }
          i += 1;
          if (i < gaps.length) {
            timers.push(window.setTimeout(run, gaps[i]));
          } else {
            retryingRef.current = false;
          }
        });
      };

      run();
    };

    const onResume = () => {
      if (document.visibilityState === "hidden") return;
      // Faqat oldin joylashuv olinmagan/muammo bo'lsa — ruxsat qayta so'ralmaydi, GPS o'qiladi.
      // "denied" sozlamalardan tashqarida o'zgarmaydi — uni qayta-qayta urinish foydasiz,
      // faqat har resume'da keraksiz fetch va (ilgari) skeleton flash keltirib chiqargan.
      const issue = getLastLocationIssue();
      if (issue != null && issue !== "denied") {
        scheduleRetries();
      }
    };

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      cancelled = true;
      retryingRef.current = false;
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, []);

  return {
    store: snap.store,
    loading,
    error: snap.error,
    outOfRange: snap.outOfRange,
    // Katalog endi joylashuvsiz ham ochiladi — soft banner kerak emas.
    needsLocation: false as boolean,
    locationIssue: snap.locationIssue,
    reload: () => retry(true),
  };
}

/** App ochilishi bilan oldindan yuklash (Home skeleton qisqaroq). */
export function prefetchStore() {
  void fetchStore();
}
