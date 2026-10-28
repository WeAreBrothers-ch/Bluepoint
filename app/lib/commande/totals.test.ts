import { describe, expect, it } from "vitest";
import { addQuantity, parseQuantity, setQuantity, toLines } from "./cart";
import { VARIANT_A, VARIANT_B, product } from "./fixtures";
import { readB2bPrices } from "./pricing";
import { computeTotals, decimalToCents, stockWarnings } from "./totals";

describe("decimalToCents", () => {
  it("lit les montants Shopify sans erreur d'arrondi", () => {
    expect(decimalToCents("18.5")).toBe(1850);
    expect(decimalToCents("0.1")).toBe(10);
    expect(decimalToCents("1440")).toBe(144000);
    expect(decimalToCents("12.345")).toBe(1235);
    expect(decimalToCents("-3.20")).toBe(-320);
  });

  it("refuse un montant illisible", () => {
    expect(decimalToCents("abc")).toBeNull();
    expect(decimalToCents("")).toBeNull();
    expect(decimalToCents(null)).toBeNull();
  });
});

describe("computeTotals", () => {
  const products = [product(), product({ variantId: VARIANT_B, productTitle: "Gamay", variantTitle: "Magnum", priceCents: 4200 })];

  it("additionne les lignes en centimes", () => {
    const totals = computeTotals([{ variantId: VARIANT_A, quantity: 12 }, { variantId: VARIANT_B, quantity: 2 }], products);
    expect(totals.subtotalCents).toBe(12 * 1850 + 2 * 4200);
    expect(totals.totalQuantity).toBe(14);
    expect(totals.lines[1]?.label).toBe("Gamay — Magnum");
  });

  it("utilise les prix B2B calculés par Shopify quand ils existent", () => {
    const totals = computeTotals([{ variantId: VARIANT_A, quantity: 6 }], products, new Map([[VARIANT_A, 1500]]));
    expect(totals.subtotalCents).toBe(9000);
  });

  it("ignore un produit inconnu", () => {
    const totals = computeTotals([{ variantId: "gid://shopify/ProductVariant/99" as typeof VARIANT_A, quantity: 1 }], products);
    expect(totals.lines).toHaveLength(0);
  });
});

describe("stockWarnings", () => {
  it("prévient quand la quantité dépasse le stock, sans bloquer", () => {
    const warnings = stockWarnings([{ variantId: VARIANT_A, quantity: 30 }], [product({ available: 24 })]);
    expect(warnings).toEqual([{ variantId: VARIANT_A, label: "Chasselas de Lavaux", requested: 30, available: 24 }]);
  });

  it("ne dit rien si le stock n'est pas suivi", () => {
    expect(stockWarnings([{ variantId: VARIANT_A, quantity: 500 }], [product({ available: null })])).toEqual([]);
  });
});

describe("quantités", () => {
  it("ajoute un carton et retire à zéro", () => {
    let quantities = addQuantity({}, VARIANT_A, 12);
    quantities = addQuantity(quantities, VARIANT_A, -1);
    expect(quantities[VARIANT_A]).toBe(11);
    quantities = setQuantity(quantities, VARIANT_A, 0);
    expect(toLines(quantities)).toEqual([]);
  });

  it("ne descend jamais sous zéro et plafonne la saisie", () => {
    expect(addQuantity({}, VARIANT_A, -1)).toEqual({});
    expect(parseQuantity("12000")).toBe(9999);
    expect(parseQuantity("abc")).toBe(0);
    expect(parseQuantity("-4")).toBe(0);
    expect(parseQuantity("6.7")).toBe(6);
  });
});

describe("readB2bPrices", () => {
  it("lit les prix unitaires du catalogue B2B", () => {
    const prices = readB2bPrices({
      currencyCode: "CHF",
      lineItems: [
        { quantity: 6, variant: { id: VARIANT_A }, approximateDiscountedUnitPriceSet: { presentmentMoney: { amount: "15.0", currencyCode: "CHF" } } },
      ],
      subtotalPriceSet: { presentmentMoney: { amount: "90.0", currencyCode: "CHF" } },
    });
    expect(prices).toEqual({ unitCents: { [VARIANT_A]: 1500 }, subtotalCents: 9000, currencyCode: "CHF" });
  });

  it("refuse une ligne sans variante", () => {
    const prices = readB2bPrices({
      currencyCode: "CHF",
      lineItems: [{ quantity: 1, variant: null, approximateDiscountedUnitPriceSet: { presentmentMoney: { amount: "1", currencyCode: "CHF" } } }],
      subtotalPriceSet: { presentmentMoney: { amount: "1", currencyCode: "CHF" } },
    });
    expect(prices).toBeNull();
  });
});
