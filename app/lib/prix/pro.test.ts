import { describe, expect, it } from "vitest";
import { PRO_DISCOUNT_FRACTION, priceLine, proCentsFromPublic, publicCentsFromPro } from "./pro";

describe("prix pro et prix particulier", () => {
  it("ajoute 15 % pour les particuliers", () => {
    expect(publicCentsFromPro(4500)).toBe(5175);
    expect(publicCentsFromPro(2500)).toBe(2875);
    expect(publicCentsFromPro(12000)).toBe(13800);
    expect(publicCentsFromPro(1800)).toBe(2070);
    expect(publicCentsFromPro(5400)).toBe(6210);
  });

  it("retrouve exactement le prix pro, pour n'importe quel prix au centime", () => {
    for (let pro = 1; pro <= 200_000; pro += 7) expect(proCentsFromPublic(publicCentsFromPro(pro))).toBe(pro);
  });

  it("la remise pro ramène le panier au prix pro : exact pour les prix ronds", () => {
    expect(PRO_DISCOUNT_FRACTION).toBeCloseTo(0.130434782, 8);
    for (const pro of [4500, 2500, 12000, 1800, 5400, 2560]) {
      for (const bottles of [6, 12, 60, 600]) {
        const line = publicCentsFromPro(pro) * bottles;
        expect(line - Math.round(line * PRO_DISCOUNT_FRACTION)).toBe(pro * bottles);
      }
    }
  });

  it("sinon, au plus un demi-centime d'écart par bouteille (arrondi du prix particulier au centime)", () => {
    for (const pro of [1235, 2550, 999, 3333]) {
      for (const bottles of [6, 60, 600]) {
        const line = publicCentsFromPro(pro) * bottles;
        const paid = line - Math.round(line * PRO_DISCOUNT_FRACTION);
        expect(Math.abs(paid - pro * bottles)).toBeLessThanOrEqual(Math.ceil(bottles / 2) + 1);
      }
    }
  });

  it("affiche les deux prix", () => {
    expect(priceLine(5175)).toBe("Prix pro CHF 45.00 · particuliers CHF 51.75");
  });
});
