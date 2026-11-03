import { describe, expect, it } from "vitest";
import { toOrderDetail } from "./mapping";
import type { OrderDetailNode } from "./query";

const money = (amount: string) => ({ shopMoney: { amount } });

function orderNode(overrides: Partial<OrderDetailNode> = {}): OrderDetailNode {
  return {
    id: "gid://shopify/Order/1",
    name: "#1014",
    createdAt: "2026-11-02T10:04:22Z",
    note: "  Livrer par l’entrée de service ",
    email: "commande@example.com",
    phone: null,
    customer: { displayName: "Nadia Exemple", email: "nadia@example.com", phone: "+41790000101" },
    shippingAddress: {
      name: "Nadia Exemple",
      company: "Le Comptoir",
      address1: "Rue Fictive 14",
      address2: " ",
      zip: "1003",
      city: "Lausanne",
      phone: null,
    },
    lineItems: {
      pageInfo: { hasNextPage: false },
      nodes: [
        { id: "l1", title: "Dézaley Marsens", variantTitle: "Default Title", quantity: 12, originalUnitPriceSet: money("25.0") },
        { id: "l2", title: "Col del Forno", variantTitle: "Magnum", quantity: 6, originalUnitPriceSet: money("18.0") },
      ],
    },
    totalDiscountsSet: money("61.2"),
    totalShippingPriceSet: money("0.0"),
    totalTaxSet: money("25.99"),
    taxesIncluded: true,
    totalPriceSet: money("346.8"),
    totalOutstandingSet: money("346.8"),
    paymentTerms: { paymentTermsName: "Net 30", paymentSchedules: { nodes: [{ dueAt: "2026-12-02T10:01:39Z" }] } },
    ...overrides,
  };
}

describe("détail d'une commande", () => {
  it("calcule les lignes et les totaux en centimes", () => {
    const detail = toOrderDetail(orderNode());
    expect(detail.lines.map((line) => [line.label, line.quantity, line.totalCents])).toEqual([
      ["Dézaley Marsens", 12, 30000],
      ["Col del Forno — Magnum", 6, 10800],
    ]);
    expect(detail.linesTotalCents).toBe(40800);
    expect(detail.discountCents).toBe(6120);
    expect(detail.totalCents).toBe(34680);
    expect(detail.taxCents).toBe(2599);
  });

  it("met l'adresse en forme d'étiquette, sans ligne vide", () => {
    expect(toOrderDetail(orderNode()).addressLines).toEqual(["Le Comptoir", "Nadia Exemple", "Rue Fictive 14", "1003 Lausanne"]);
    expect(toOrderDetail(orderNode({ shippingAddress: null })).addressLines).toEqual([]);
  });

  it("préfère les coordonnées du client à celles de la commande", () => {
    expect(toOrderDetail(orderNode()).contact).toEqual({
      name: "Nadia Exemple",
      email: "nadia@example.com",
      phone: "+41790000101",
    });
    expect(toOrderDetail(orderNode({ customer: null })).contact.email).toBe("commande@example.com");
  });

  it("donne l'échéance en date suisse et nettoie la note", () => {
    const detail = toOrderDetail(orderNode());
    expect(detail.paymentTerms).toEqual({ name: "Net 30", dueOn: "2026-12-02" });
    expect(detail.note).toBe("Livrer par l’entrée de service");
    expect(toOrderDetail(orderNode({ note: "  ", paymentTerms: null }))).toMatchObject({ note: null, paymentTerms: null });
  });

  it("ne plante pas sur un montant illisible", () => {
    expect(toOrderDetail(orderNode({ totalShippingPriceSet: money("n/a") })).shippingCents).toBe(0);
  });
});
