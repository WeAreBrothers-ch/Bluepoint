import type { IsoDate } from "../metafields/definitions";
import type { OrderGid } from "../shopify/ids";
import type { AgendaOrderNode } from "./query";
import type { DeliveryTask } from "./types";

/** Données d'exemple partagées par les tests de l'agenda. */

export function orderNode(overrides: Partial<AgendaOrderNode> = {}): AgendaOrderNode {
  return {
    id: "gid://shopify/Order/1042",
    name: "#1042",
    cancelledAt: null,
    displayFulfillmentStatus: "UNFULFILLED",
    displayFinancialStatus: "PAID",
    customer: { displayName: "Claire Monnier", tags: [] },
    purchasingEntity: null,
    shippingAddress: { name: "Claire Monnier", city: "Cully", company: null },
    customAttributes: [],
    dateSouhaitee: null,
    dateLimite: null,
    mode: null,
    fulfillments: [],
    ...overrides,
  };
}

let counter = 0;

export function task(overrides: Partial<DeliveryTask> = {}): DeliveryTask {
  counter += 1;
  return {
    orderId: `gid://shopify/Order/${counter}` as OrderGid,
    name: `#${1000 + counter}`,
    customerName: "Client",
    company: null,
    isPro: false,
    city: "Lausanne",
    requestedDate: null,
    deadline: null,
    dateSource: "metachamp",
    mode: "livraison",
    status: "a_livrer",
    financialStatus: "PAID",
    ...overrides,
  };
}

export const d = (value: string): IsoDate => value as IsoDate;
