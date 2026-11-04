import { describe, expect, it } from "vitest";
import { d, orderNode } from "../agenda/fixtures";
import { cleanSearchTerm, ordersHref, ordersSearchQuery, toOrderListItem, type OrderListNode } from "./list";

const TODAY = d("2026-11-04");

function node(overrides: Partial<OrderListNode> = {}): OrderListNode {
  return { ...orderNode(), createdAt: "2026-10-28T10:00:00Z", ...overrides };
}

describe("recherche des commandes", () => {
  it("enlève ce qui a un sens dans la recherche de Shopify", () => {
    expect(cleanSearchTerm('  Le "Chalet" (Vevey): status:open ')).toBe("Le Chalet Vevey status open");
    expect(cleanSearchTerm("a".repeat(200))).toHaveLength(60);
  });

  it("combine l'onglet et ce qui a été tapé", () => {
    expect(ordersSearchQuery("toutes", "")).toBe("");
    expect(ordersSearchQuery("toutes", "Favre")).toBe("Favre");
    expect(ordersSearchQuery("livrees", "Favre")).toBe("fulfillment_status:fulfilled AND -status:cancelled AND Favre");
    expect(ordersSearchQuery("annulees", "")).toBe("status:cancelled");
  });

  it("cherche un numéro de commande par son numéro", () => {
    expect(ordersSearchQuery("toutes", "1051")).toBe("name:1051");
    expect(ordersSearchQuery("a_livrer", "#1051")).toBe("status:open AND -status:cancelled AND -fulfillment_status:fulfilled AND name:1051");
  });

  it("garde l'onglet, la recherche et la page dans l'adresse", () => {
    expect(ordersHref("toutes", "")).toBe("/app/commandes");
    expect(ordersHref("livrees", "Le Chalet")).toBe("/app/commandes?onglet=livrees&q=Le+Chalet");
    expect(ordersHref("toutes", "", "abc")).toBe("/app/commandes?apres=abc");
  });
});

describe("une commande de la liste", () => {
  it("dit quand elle a été passée et où en est la livraison", () => {
    const item = toOrderListItem(node(), TODAY);
    expect(item?.orderedLabel).toBe("Passée le 28 octobre");
    expect(item?.cancelled).toBe(false);
    expect(item?.deliveryLine).not.toBe("");
  });

  it("garde une commande annulée, marquée comme telle", () => {
    const item = toOrderListItem(node({ cancelledAt: "2026-11-01T10:00:00Z" }), TODAY);
    expect(item?.cancelled).toBe(true);
    expect(item?.deliveryLine).toBe("Commande annulée");
  });

  it("dit le jour de livraison d'une commande livrée", () => {
    const item = toOrderListItem(
      node({
        displayFulfillmentStatus: "FULFILLED",
        fulfillments: [{ status: "SUCCESS", displayStatus: "DELIVERED", createdAt: "2026-11-03T09:00:00Z" }],
      }),
      TODAY,
    );
    expect(item?.deliveryLine).toBe("Livrée le 3 novembre");
  });

  it("ignore une commande dont l'identifiant est illisible", () => {
    expect(toOrderListItem(node({ id: "pas-un-identifiant" }), TODAY)).toBeNull();
  });
});
