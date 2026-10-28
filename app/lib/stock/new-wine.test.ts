import { describe, expect, it } from "vitest";
import { createdMessage, parseNewWine, parsePrice, shopifyPrice } from "./new-wine";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("nouveau vin", () => {
  it("lit le prix comme on l'écrit en Suisse", () => {
    expect(parsePrice("25")).toBe(2500);
    expect(parsePrice("25.5")).toBe(2550);
    expect(parsePrice("25,50")).toBe(2550);
    expect(parsePrice("25.-")).toBe(2500);
    expect(parsePrice("CHF 1'250.00")).toBe(125000);
    expect(parsePrice("vingt")).toBeNull();
    expect(parsePrice("25.505")).toBeNull();
    expect(shopifyPrice(2550)).toBe("25.50");
    expect(shopifyPrice(1805)).toBe("18.05");
  });

  it("accepte un vin complet, sans producteur ni bouteille", () => {
    const parsed = parseNewWine(form({ title: "  Chasselas 2025 ", vendor: "", type: "Blanc", price: "18", quantity: "" }));
    expect(parsed).toEqual({ ok: true, input: { title: "Chasselas 2025", vendor: null, productType: "Blanc", priceCents: 1800, quantity: 0 } });
    const other = parseNewWine(form({ title: "Coffret", vendor: "BluePoint", type: "Autre", price: "60", quantity: "4" }));
    expect(other.ok && other.input.productType).toBeNull();
  });

  it("dit ce qui manque, case par case, et garde ce qui a été tapé", () => {
    const parsed = parseNewWine(form({ title: "", vendor: "", type: "Rouge", price: "0", quantity: "-3" }));
    expect(parsed).toEqual({
      ok: false,
      values: { title: "", vendor: "", type: "Rouge", price: "0", quantity: "-3" },
      errors: {
        title: "Écrivez le nom du vin.",
        price: "Écrivez le prix d’une bouteille, par exemple 25.50.",
        quantity: "Écrivez le nombre de bouteilles (0 s’il n’y en a pas encore).",
      },
    });
    expect(parseNewWine(form({ title: "Merlot", vendor: "", type: "Violet", price: "20", quantity: "1" })).ok).toBe(false);
  });

  it("annonce le vin créé", () => {
    expect(createdMessage({ title: "Chasselas 2025", priceCents: 1800, quantity: 24 }, true)).toBe(
      "Le vin « Chasselas 2025 » est créé, à CHF\u00A018.00, avec 24 bouteilles en cave. Il est en vente sur le site et dans « Prendre une commande ».",
    );
    expect(createdMessage({ title: "Merlot", priceCents: 2000, quantity: 0 }, false)).toContain(
      "sans bouteille en cave pour l’instant. Il est dans « Prendre une commande », mais pas encore visible sur le site.",
    );
  });
});
