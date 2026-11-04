import { describe, expect, it } from "vitest";
import { centsToMoney, parsePrice } from "./price";

describe("prix d'un vin", () => {
  it("lit un prix écrit de plusieurs façons", () => {
    expect(parsePrice("55")).toEqual({ ok: true, cents: 5500 });
    expect(parsePrice("55.5")).toEqual({ ok: true, cents: 5550 });
    expect(parsePrice("55,50")).toEqual({ ok: true, cents: 5550 });
    expect(parsePrice(" CHF 1'250.00 ")).toEqual({ ok: true, cents: 125000 });
    expect(parsePrice("24.9")).toEqual({ ok: true, cents: 2490 });
  });

  it("refuse ce qui n'est pas un prix", () => {
    for (const raw of ["", "abc", "55.555", "-5", "1 2 3.4.5", "12,34,56"]) {
      expect(parsePrice(raw).ok).toBe(false);
    }
  });

  it("refuse zéro et un prix absurde", () => {
    expect(parsePrice("0")).toMatchObject({ ok: false, message: "Le prix doit être plus grand que zéro." });
    expect(parsePrice("99999")).toMatchObject({ ok: false, message: "Ce prix semble trop élevé. Vérifiez-le." });
  });

  it("écrit le prix comme Shopify l'attend", () => {
    expect(centsToMoney(5500)).toBe("55.00");
    expect(centsToMoney(5550)).toBe("55.50");
  });
});
