import { create } from "zustand";

interface CheckoutDraftState {
  phone: string;
  comment: string;
  loc: { lat: number; lng: number } | null;
  /** GPS + reverse-geocode dan bir qator manzil */
  addressLine: string;
  locating: boolean;
  setPhone: (phone: string) => void;
  setComment: (comment: string) => void;
  setLocation: (lat: number, lng: number) => void;
  setAddressLine: (line: string) => void;
  setLocating: (v: boolean) => void;
  reset: () => void;
}

/** Checkout formasi qoralamasi. */
export const useCheckoutDraft = create<CheckoutDraftState>((set) => ({
  phone: "",
  comment: "",
  loc: null,
  addressLine: "",
  locating: false,
  setPhone: (phone) => set({ phone }),
  setComment: (comment) => set({ comment }),
  setLocation: (lat, lng) => set({ loc: { lat, lng } }),
  setAddressLine: (addressLine) => set({ addressLine }),
  setLocating: (locating) => set({ locating }),
  reset: () =>
    set({
      phone: "",
      comment: "",
      loc: null,
      addressLine: "",
      locating: false,
    }),
}));

export function isAddressComplete(line: string): boolean {
  return line.trim().length >= 4;
}
