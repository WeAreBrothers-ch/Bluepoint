import { describe, expect, it } from "vitest";
import { categoryOf, countryOf, parseBottleSize, readWineInfo, withWineTags } from "./wine-info";

describe("informations d'un vin", () => {
  it("lit la contenance comme on l'écrit", () => {
    expect(parseBottleSize("75")).toBe(750);
    expect(parseBottleSize("75cl")).toBe(750);
    expect(parseBottleSize("37,5 cl")).toBe(375);
    expect(parseBottleSize("0.75 l")).toBe(750);
    expect(parseBottleSize("1.5L")).toBe(1500);
    expect(parseBottleSize("750 ml")).toBe(750);
    expect(parseBottleSize("beaucoup")).toBeNull();
    expect(parseBottleSize("0")).toBeNull();
  });

  it("lit les étiquettes de la boutique, majuscules et accents sans importance", () => {
    const info = readWineInfo("Rouge", ["rouge", "Pays:italie", "region:Piémont", "Contenance:75", "millésime:2019".replace("é", "e"), "appellation:Barolo DOCG", "promo"]);
    expect(info).toEqual({
      productType: "Rouge",
      country: "Italie",
      region: "Piémont",
      appellation: "Barolo DOCG",
      vintage: "2019",
      bottleMl: 750,
    });
    expect(readWineInfo(null, [])).toEqual({ productType: null, country: null, region: null, appellation: null, vintage: null, bottleMl: null });
  });

  it("change seulement les étiquettes demandées et garde les autres", () => {
    const tags = ["rouge", "pays:Italie", "contenance:70", "promo"];
    expect(withWineTags(tags, { country: "France", bottleMl: 750 })).toEqual(["rouge", "promo", "pays:France", "contenance:75"]);
    expect(withWineTags(tags, { bottleMl: 375 })).toEqual(["rouge", "pays:Italie", "promo", "contenance:37.5"]);
    expect(withWineTags(tags, { country: null })).toEqual(["rouge", "contenance:70", "promo"]);
    expect(withWineTags(["PAYS:Suisse"], { country: "Italie" })).toEqual(["pays:Italie"]);
  });

  it("classe les vins par sorte, et le champagne vient toujours de France", () => {
    expect(categoryOf({ productType: "Rosé", appellation: null })).toBe("Rosé");
    expect(categoryOf({ productType: "Rose", appellation: null })).toBe("Rosé");
    expect(categoryOf({ productType: "Effervescent", appellation: "Champagne" })).toBe("Champagne");
    expect(categoryOf({ productType: "Effervescent", appellation: "Prosecco DOC" })).toBe("Effervescent");
    expect(categoryOf({ productType: "Spiritueux", appellation: null })).toBe("Spiritueux");
    expect(categoryOf({ productType: null, appellation: null })).toBe("Autre");
    expect(countryOf({ productType: "Effervescent", appellation: "Champagne", country: null })).toBe("France");
    expect(countryOf({ productType: "Blanc", appellation: null, country: "Suisse" })).toBe("Suisse");
  });
});

import { parseWineInfoForm } from "./info-form";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("compléter un vin", () => {
  const productId = "gid://shopify/Product/42";

  it("accepte le pays et la contenance", () => {
    expect(parseWineInfoForm(form({ productId, country: "Italie", size: "75" }))).toEqual({
      ok: true,
      productId,
      changes: { country: "Italie", bottleMl: 750 },
    });
  });

  it("refuse ce qui n'est pas dans les listes, avec une phrase claire", () => {
    expect(parseWineInfoForm(form({ productId, country: "Atlantide" }))).toMatchObject({ ok: false, message: "Choisissez le pays dans la liste." });
    expect(parseWineInfoForm(form({ productId, size: "énorme" }))).toMatchObject({ ok: false });
    expect(parseWineInfoForm(form({ productId, vintage: "22" }))).toMatchObject({ ok: false });
    expect(parseWineInfoForm(form({ productId }))).toMatchObject({ ok: false, message: "Choisissez au moins le pays ou la contenance." });
    expect(parseWineInfoForm(form({ productId: "n'importe quoi", country: "France" }))).toMatchObject({ ok: false });
  });
});
