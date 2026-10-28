import { describe, expect, it } from "vitest";
import { CATALOG_QUERY } from "./queries";

describe("CATALOG_QUERY", () => {
  it("filtre les produits actifs avec une valeur en minuscules (en majuscules, Shopify ne renvoie rien)", () => {
    expect(CATALOG_QUERY).toContain('query: "product_status:active"');
    expect(CATALOG_QUERY).not.toMatch(/product_status:[A-Z]/);
  });
});
