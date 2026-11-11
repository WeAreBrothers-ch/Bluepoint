import { describe, expect, it } from "vitest";
import { buildReport, formatBottleSize, formatLiters, NO_COUNTRY, type SoldLine } from "./report";

function line(over: Partial<SoldLine>): SoldLine {
  return { productId: "gid://shopify/Product/1", title: "Dézaley", vendor: "Marsens", productType: "Blanc", tags: ["pays:Suisse", "contenance:75"], bottles: 6, month: 3, ...over };
}

describe("litres vendus", () => {
  it("multiplie les bouteilles par leur contenance, par sorte et par pays", () => {
    const report = buildReport([
      line({ bottles: 12 }),
      line({ bottles: 6, month: 4 }),
      line({ productId: "2", title: "Barolo", productType: "Rouge", tags: ["pays:Italie", "contenance:75"], bottles: 12 }),
      line({ productId: "3", title: "Brut", productType: "Effervescent", tags: ["appellation:Champagne", "contenance:150"], bottles: 6 }),
      line({ productId: "4", title: "Petit rosé", productType: "Rosé", tags: ["pays:France", "contenance:37.5"], bottles: 24 }),
    ]);
    expect(report.totals.wineBottles).toBe(60);
    // 18×0.75 + 12×0.75 + 6×1.5 + 24×0.375 = 13.5 + 9 + 9 + 9
    expect(report.totals.wineMl).toBe(40_500);
    expect(report.byCategoryCountry.map((row) => `${row.category}/${row.country}/${row.ml}`)).toEqual([
      "Rouge/Italie/9000",
      "Blanc/Suisse/13500",
      "Rosé/France/9000",
      "Champagne/France/9000",
    ]);
    // En mars : 12 Dézaley (9 L) + 12 Barolo (9 L) + 6 magnums de champagne (9 L) + 24 demi-bouteilles de rosé (9 L).
    expect(report.monthlyMl[2]).toBe(36_000);
    expect(report.monthlyMl[3]).toBe(4500);
  });

  it("compte les mois en litres de vin", () => {
    const report = buildReport([line({ bottles: 12, month: 1 }), line({ bottles: 6, month: 12 })]);
    expect(report.monthlyMl[0]).toBe(9000);
    expect(report.monthlyMl[11]).toBe(4500);
    expect(report.monthlyMl.reduce((a, b) => a + b, 0)).toBe(report.totals.wineMl);
  });

  it("suppose 75 cl quand la contenance manque, et le dit", () => {
    const report = buildReport([line({ productId: "9", title: "Sans taille", tags: ["pays:Suisse"], bottles: 6 })]);
    expect(report.totals.wineMl).toBe(4500);
    expect(report.assumedBottles).toBe(6);
    expect(report.incomplete).toEqual([
      { productId: "9", title: "Sans taille", category: "Blanc", bottles: 6, missing: ["contenance"], country: "Suisse", bottleMl: null },
    ]);
  });

  it("garde à part le vin sans pays, sans l'oublier du total", () => {
    const report = buildReport([line({ productId: "8", title: "Mystère", tags: ["contenance:75"] })]);
    expect(report.byCategoryCountry).toEqual([{ category: "Blanc", country: NO_COUNTRY, bottles: 6, ml: 4500 }]);
    expect(report.incomplete[0]?.missing).toEqual(["pays"]);
  });

  it("sépare les spiritueux et les autres produits du total du vin", () => {
    const report = buildReport([
      line({ productId: "5", title: "Gin", productType: "Spiritueux", tags: ["contenance:70"], bottles: 6 }),
      line({ productId: "6", title: "Coffret", productType: null, tags: [], bottles: 3 }),
      line({ bottles: 6 }),
    ]);
    expect(report.totals.wineMl).toBe(4500);
    expect(report.totals.spiritsMl).toBe(4200);
    expect(report.totals.spiritsBottles).toBe(6);
    expect(report.totals.otherUnits).toBe(3);
    expect(report.incomplete).toEqual([]);
  });

  it("garde un vin supprimé de Shopify, sans proposer de le corriger", () => {
    const report = buildReport([line({ productId: null, title: "Ancien vin", tags: [], bottles: 6 })]);
    expect(report.totals.wineBottles).toBe(6);
    expect(report.incomplete).toEqual([]);
  });

  it("affiche les litres et les bouteilles à la suisse", () => {
    expect(formatLiters(1_234_500)).toBe("1’234.50 L");
    expect(formatLiters(4500)).toBe("4.50 L");
    expect(formatBottleSize(750)).toBe("75 cl");
    expect(formatBottleSize(375)).toBe("37.5 cl");
    expect(formatBottleSize(1500)).toBe("1.5 L");
  });
});
