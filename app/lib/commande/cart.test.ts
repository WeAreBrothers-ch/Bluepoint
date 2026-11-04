import { describe, expect, it } from "vitest";
import { cartonsOf, isFullCartons, nextCartonQuantity, previousCartonQuantity, quantityFromCartons } from "./cart";

describe("vente par cartons de 6", () => {
  it("reconnaît un nombre entier de cartons, au moins un", () => {
    expect([6, 12, 18, 600].every(isFullCartons)).toBe(true);
    expect([0, 1, 3, 5, 7, 13, 5.5, -6].some(isFullCartons)).toBe(false);
  });

  it("compte les cartons", () => {
    expect(cartonsOf(6)).toBe(1);
    expect(cartonsOf(18)).toBe(3);
  });

  it("transforme un nombre de cartons tapé en bouteilles", () => {
    expect(quantityFromCartons("2")).toBe(12);
    expect(quantityFromCartons(" 1 ")).toBe(6);
    expect(quantityFromCartons("0")).toBe(0);
    expect(quantityFromCartons("abc")).toBe(0);
    expect(quantityFromCartons("-3")).toBe(0);
  });

  it("monte et descend d'un carton, même depuis une ancienne quantité qui n'en est pas un", () => {
    expect(nextCartonQuantity(0)).toBe(6);
    expect(nextCartonQuantity(6)).toBe(12);
    expect(nextCartonQuantity(3)).toBe(6);
    expect(nextCartonQuantity(9)).toBe(12);
    expect(previousCartonQuantity(12)).toBe(6);
    expect(previousCartonQuantity(6)).toBe(0);
    expect(previousCartonQuantity(9)).toBe(6);
    expect(previousCartonQuantity(3)).toBe(0);
  });
});
