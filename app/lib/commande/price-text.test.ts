import { describe, expect, it } from "vitest";
import { winePriceText } from "./price-text";

/** formatChf met une espace insécable après « CHF ». */
const chf = (amount: string) => `CHF\u00A0${amount}`;

describe("prix d'un vin dans « Prendre une commande »", () => {
  it("montre seulement le prix du client choisi, à la bouteille et au carton de 6", () => {
    // 51.75 particulier = 45.00 pro (+ 15 %).
    expect(winePriceText(5175, "pro")).toBe(`${chf("45.00")} la bouteille · ${chf("270.00")} le carton (prix pro)`);
    expect(winePriceText(5175, "particulier")).toBe(`${chf("51.75")} la bouteille · ${chf("310.50")} le carton`);
  });

  it("montre les deux prix tant qu'aucun client n'est choisi", () => {
    expect(winePriceText(5175, null)).toBe(`Bouteille\u202F: ${chf("45.00")} pro, ${chf("51.75")} particulier`);
  });
});
