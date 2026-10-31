import { describe, expect, it } from "vitest";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_LABELS, formatFcfa } from "../src/index";

const normalizeSpaces = (value: string): string => value.replace(/\s/g, " ");

describe("formatFcfa", () => {
  it("formate un montant avec séparateurs de milliers et suffixe FCFA", () => {
    expect(normalizeSpaces(formatFcfa(120000))).toBe("120 000 FCFA");
  });

  it("formate zéro", () => {
    expect(normalizeSpaces(formatFcfa(0))).toBe("0 FCFA");
  });

  it("formate un montant de vente élevé", () => {
    expect(normalizeSpaces(formatFcfa(28000000))).toBe("28 000 000 FCFA");
  });

  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuse le montant invalide %s",
    (amount) => {
      expect(() => formatFcfa(amount)).toThrow(RangeError);
    },
  );
});

describe("catégories de véhicules", () => {
  it("contient les cinq catégories validées, dont Kavaki", () => {
    expect(VEHICLE_CATEGORIES).toEqual(["MOTO", "KAVAKI", "VOITURE", "CAMION", "BUS"]);
  });

  it("fournit un libellé pour chaque catégorie", () => {
    for (const category of VEHICLE_CATEGORIES) {
      expect(VEHICLE_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});
