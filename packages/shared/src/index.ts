export const APP_NAME = "VLV" as const;
export const DEFAULT_LOCALE = "fr" as const;
export const DEFAULT_CURRENCY = "XAF" as const;
export const BUSINESS_TIME_ZONE = "Africa/Brazzaville" as const;

export const VEHICLE_CATEGORIES = ["MOTO", "KAVAKI", "VOITURE", "CAMION", "BUS"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  MOTO: "Moto",
  KAVAKI: "Kavaki",
  VOITURE: "Voiture",
  CAMION: "Camion",
  BUS: "Bus",
};

export const OFFER_TYPES = ["RENT", "SALE"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

/**
 * Formate un montant en FCFA (XAF).
 * Les montants sont toujours des entiers : le franc CFA n'a pas de décimales,
 * et on ne manipule jamais d'argent en nombres à virgule.
 */
export function formatFcfa(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("Le montant doit être un entier positif ou nul (en FCFA).");
  }
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount);
  return `${formatted} FCFA`;
}
