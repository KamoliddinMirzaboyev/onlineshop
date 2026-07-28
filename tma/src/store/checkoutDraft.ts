import { create } from "zustand";

export interface AddressParts {
  /** Mahalla / ko'cha / kvartal */
  street: string;
  /** Uy / bino raqami */
  house: string;
  /** Xonadon (ixtiyoriy) */
  apartment: string;
  /** Podyezd (ixtiyoriy) */
  entrance: string;
  /** Qavat (ixtiyoriy) */
  floor: string;
  /** Qo'shimcha mo'ljal (ixtiyoriy) */
  landmark: string;
}

interface CheckoutDraftState {
  phone: string;
  comment: string;
  loc: { lat: number; lng: number } | null;
  /** GPS yoki reverse-geocode dan kelgan taxminiy manzil (faqat yordamchi) */
  geoHint: string;
  addressParts: AddressParts;
  setPhone: (phone: string) => void;
  setComment: (comment: string) => void;
  setLocation: (lat: number, lng: number, geoHint?: string) => void;
  setAddressPart: <K extends keyof AddressParts>(key: K, value: string) => void;
  reset: () => void;
}

const emptyParts = (): AddressParts => ({
  street: "",
  house: "",
  apartment: "",
  entrance: "",
  floor: "",
  landmark: "",
});

/** Checkout formasi qoralamasi. */
export const useCheckoutDraft = create<CheckoutDraftState>((set) => ({
  phone: "",
  comment: "",
  loc: null,
  geoHint: "",
  addressParts: emptyParts(),
  setPhone: (phone) => set({ phone }),
  setComment: (comment) => set({ comment }),
  setLocation: (lat, lng, geoHint = "") =>
    set({ loc: { lat, lng }, geoHint }),
  setAddressPart: (key, value) =>
    set((s) => ({ addressParts: { ...s.addressParts, [key]: value } })),
  reset: () =>
    set({
      phone: "",
      comment: "",
      loc: null,
      geoHint: "",
      addressParts: emptyParts(),
    }),
}));

/** Buyurtma uchun bitta manzil qatori. */
export function formatAddressLine(p: AddressParts, geoHint?: string): string {
  const parts: string[] = [];
  if (p.street.trim()) parts.push(p.street.trim());
  if (p.house.trim()) parts.push(`uy ${p.house.trim()}`);
  if (p.entrance.trim()) parts.push(`podyezd ${p.entrance.trim()}`);
  if (p.floor.trim()) parts.push(`${p.floor.trim()}-qavat`);
  if (p.apartment.trim()) parts.push(`xonadon ${p.apartment.trim()}`);
  if (p.landmark.trim()) parts.push(p.landmark.trim());
  const line = parts.join(", ");
  if (line) return line;
  return (geoHint ?? "").trim();
}

export function isAddressComplete(p: AddressParts): boolean {
  return p.street.trim().length >= 3 && p.house.trim().length >= 1;
}
