import { describe, expect, it } from "vitest";
import { plainShopifyRefusal } from "./plain-refusal";

describe("refus de Shopify en clair", () => {
  it("traduit les refus courants", () => {
    expect(plainShopifyRefusal("Not enough inventory available for Barolo")).toMatch(/plus assez de stock/);
    expect(plainShopifyRefusal("Product variant does not exist")).toMatch(/plus en vente/);
    expect(plainShopifyRefusal("Zip is invalid for Switzerland")).toMatch(/adresse du client/);
    expect(plainShopifyRefusal("The fulfillment order is on hold")).toMatch(/en attente/);
    expect(plainShopifyRefusal("Order has been fulfilled")).toMatch(/déjà fait/);
    expect(plainShopifyRefusal("Order was cancelled")).toMatch(/annulée/);
  });

  it("ne devine pas un refus inconnu", () => {
    expect(plainShopifyRefusal("Something unexpected happened")).toBeNull();
    expect(plainShopifyRefusal("Discount threshold reached")).toBeNull();
  });
});
