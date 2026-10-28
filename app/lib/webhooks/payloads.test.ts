import { describe, expect, it } from "vitest";
import { readOrderPaid } from "./payloads";

describe("webhook orders/paid", () => {
  it("lit l'identifiant de la commande", () => {
    expect(readOrderPaid({ admin_graphql_api_id: "gid://shopify/Order/1234567890" })).toBe("gid://shopify/Order/1234567890");
  });

  it("refuse une charge inattendue", () => {
    expect(readOrderPaid(null)).toBeNull();
    expect(readOrderPaid({})).toBeNull();
    expect(readOrderPaid({ admin_graphql_api_id: "gid://shopify/Customer/1" })).toBeNull();
    expect(readOrderPaid([])).toBeNull();
  });
});
