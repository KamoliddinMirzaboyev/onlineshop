import { create } from "zustand";

interface CheckoutDraftState {
  phone: string;
  comment: string;
  loc: { lat: number; lng: number; accuracyM?: number } | null;
  /** loc qayerdan kelgani: submit paytida "map" bo'lsa GPS bilan qayta yozilmaydi */
  locSource: "gps" | "map" | null;
  /** GPS + reverse-geocode dan bir qator manzil */
  addressLine: string;
  /** Foydalanuvchi matnni qo'lda tahrirlagan — geocode ustiga yozmasin */
  addressDirty: boolean;
  locating: boolean;
  setPhone: (phone: string) => void;
  setComment: (comment: string) => void;
  setLocation: (lat: number, lng: number, accuracyM?: number, source?: "gps" | "map") => void;
  /** fromUser: true — dirty; false — avto geocode */
  setAddressLine: (line: string, fromUser?: boolean) => void;
  setLocating: (v: boolean) => void;
  reset: () => void;
}

/** Checkout formasi qoralamasi. */
export const useCheckoutDraft = create<CheckoutDraftState>((set) => ({
  phone: "",
  comment: "",
  loc: null,
  locSource: null,
  addressLine: "",
  addressDirty: false,
  locating: false,
  setPhone: (phone) => set({ phone }),
  setComment: (comment) => set({ comment }),
  setLocation: (lat, lng, accuracyM, source = "gps") =>
    set({ loc: { lat, lng, accuracyM }, locSource: source }),
  setAddressLine: (addressLine, fromUser = true) =>
    set((s) => ({
      addressLine,
      addressDirty: fromUser ? true : s.addressDirty,
    })),
  setLocating: (locating) => set({ locating }),
  reset: () =>
    set({
      phone: "",
      comment: "",
      loc: null,
      locSource: null,
      addressLine: "",
      addressDirty: false,
      locating: false,
    }),
}));

export function isAddressComplete(line: string): boolean {
  // Geocode muvaffaqiyatsiz bo'lsa ham koordinata satri (lat,lng) yetarli.
  return line.trim().length >= 4;
}
