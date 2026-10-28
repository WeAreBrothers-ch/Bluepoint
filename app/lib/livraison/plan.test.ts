import { describe, expect, it } from "vitest";
import type { DeliveryOrderState } from "./operations";
import { planDelivery } from "./plan";

const createAction = [{ action: "CREATE_FULFILLMENT" }];

function order(overrides: Partial<DeliveryOrderState> = {}): DeliveryOrderState {
  return {
    id: "gid://shopify/Order/1",
    name: "#1001",
    cancelledAt: null,
    displayFulfillmentStatus: "UNFULFILLED",
    fulfillmentOrders: { nodes: [{ id: "fo-1", status: "OPEN", supportedActions: createAction }] },
    fulfillments: [],
    ...overrides,
  };
}

describe("planDelivery", () => {
  it("expédie les ordres ouverts d'une commande non expédiée", () => {
    expect(planDelivery(order())).toEqual({ kind: "a_faire", fulfillmentOrderIds: ["fo-1"], fulfillmentIdsToDeliver: [] });
  });

  it("marque livrée une commande déjà expédiée, sans nouvelle expédition", () => {
    const shipped = order({
      displayFulfillmentStatus: "FULFILLED",
      fulfillmentOrders: { nodes: [{ id: "fo-1", status: "CLOSED", supportedActions: [] }] },
      fulfillments: [{ id: "f-1", status: "SUCCESS", displayStatus: "FULFILLED" }],
    });
    expect(planDelivery(shipped)).toEqual({ kind: "a_faire", fulfillmentOrderIds: [], fulfillmentIdsToDeliver: ["f-1"] });
  });

  it("ne refait rien sur une commande déjà livrée (idempotent)", () => {
    const delivered = order({
      displayFulfillmentStatus: "FULFILLED",
      fulfillmentOrders: { nodes: [{ id: "fo-1", status: "CLOSED", supportedActions: [] }] },
      fulfillments: [
        { id: "f-1", status: "SUCCESS", displayStatus: "DELIVERED" },
        { id: "f-0", status: "CANCELLED", displayStatus: "CANCELED" },
      ],
    });
    expect(planDelivery(delivered)).toEqual({ kind: "deja_livree" });
  });

  it("termine une livraison partielle", () => {
    const partial = order({
      fulfillmentOrders: {
        nodes: [
          { id: "fo-1", status: "CLOSED", supportedActions: [] },
          { id: "fo-2", status: "IN_PROGRESS", supportedActions: createAction },
        ],
      },
      fulfillments: [{ id: "f-1", status: "SUCCESS", displayStatus: "DELIVERED" }],
    });
    expect(planDelivery(partial)).toEqual({ kind: "a_faire", fulfillmentOrderIds: ["fo-2"], fulfillmentIdsToDeliver: [] });
  });

  it("refuse une commande annulée, en attente, ou sans article", () => {
    expect(planDelivery(order({ cancelledAt: "2026-10-20T08:00:00Z" }))).toEqual({ kind: "bloquee", reason: "annulee" });
    const onHold = order({ fulfillmentOrders: { nodes: [{ id: "fo-1", status: "ON_HOLD", supportedActions: [] }] } });
    expect(planDelivery(onHold)).toEqual({ kind: "bloquee", reason: "en_attente" });
    expect(planDelivery(order({ fulfillmentOrders: { nodes: [] } }))).toEqual({ kind: "bloquee", reason: "rien_a_expedier" });
  });

  it("ignore un ordre ouvert qui n'accepte pas d'expédition directe", () => {
    const external = order({ fulfillmentOrders: { nodes: [{ id: "fo-1", status: "OPEN", supportedActions: [{ action: "REQUEST_FULFILLMENT" }] }] } });
    expect(planDelivery(external)).toEqual({ kind: "bloquee", reason: "rien_a_expedier" });
  });
});
