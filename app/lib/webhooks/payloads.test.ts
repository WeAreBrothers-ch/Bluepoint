import { describe, expect, it } from "vitest";
import { readOrderCancelled, readOrderPaid } from "./payloads";

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

describe("webhook orders/cancelled", () => {
  it("lit l'identifiant de la commande annulée", () => {
    expect(readOrderCancelled({ admin_graphql_api_id: "gid://shopify/Order/1234567890", cancelled_at: "2026-11-19T12:00:00Z" })).toBe("gid://shopify/Order/1234567890");
    expect(readOrderCancelled({ admin_graphql_api_id: "gid://shopify/Customer/1" })).toBeNull();
  });
});
