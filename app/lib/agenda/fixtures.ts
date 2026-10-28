import type { IsoDate } from "../metafields/definitions";
import type { OrderGid } from "../shopify/ids";
import type { AgendaOrderNode } from "./query";
import type { DeliveryTask } from "./types";

/** Données d'exemple partagées par les tests de l'agenda. */

type ShippingAddress = NonNullable<AgendaOrderNode["shippingAddress"]>;

export function address(overrides: Partial<ShippingAddress> = {}): ShippingAddress {
  return { name: "Claire Monnier", city: "Cully", company: null, address1: null, address2: null, zip: null, phone: null, ...overrides };
}

export function orderNode(overrides: Partial<AgendaOrderNode> = {}): AgendaOrderNode {
  return {
    id: "gid://shopify/Order/1042",
    name: "#1042",
    cancelledAt: null,
    note: null,
    displayFulfillmentStatus: "UNFULFILLED",
    displayFinancialStatus: "PAID",
    currentTotalPriceSet: null,
    customer: { displayName: "Claire Monnier", tags: [], defaultPhoneNumber: null },
    purchasingEntity: null,
    shippingAddress: address(),
    customAttributes: [],
    lineItems: { nodes: [] },
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
    street: null,
    zip: null,
    city: "Lausanne",
    phone: null,
    note: null,
    items: [],
    totalCents: null,
    requestedDate: null,
    deadline: null,
    dateSource: "metachamp",
    mode: "livraison",
    status: "a_livrer",
    deliveredOn: null,
    financialStatus: "PAID",
    ...overrides,
  };
}

export const d = (value: string): IsoDate => value as IsoDate;
