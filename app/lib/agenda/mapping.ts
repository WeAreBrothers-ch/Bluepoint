import { decimalToCents } from "../commande/totals";
import { isDeliveryMode, parseIsoDate, type DeliveryMode, type IsoDate } from "../metafields/definitions";
import { parseGid } from "../shopify/ids";
import { CART_ATTRIBUTE_KEYS, findAttribute, parseLooseDate } from "./attributes";
import { swissIsoDate } from "./dates";
import type { AgendaOrderNode } from "./query";
import type { DateSource, DeliveryStatus, DeliveryTask, FinancialStatus, OrderItem } from "./types";

/** Transforme une commande Shopify (réponse GraphQL) en tâche de livraison. */

/** Étiquettes client qui signalent un professionnel quand la boutique n'utilise pas le B2B Shopify. */
export const PRO_CUSTOMER_TAGS: readonly string[] = ["pro", "professionnel", "b2b"];

const FINANCIAL_STATUSES: readonly FinancialStatus[] = [
  "AUTHORIZED", "EXPIRED", "PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "VOIDED",
];

const DELIVERED_DISPLAY = new Set(["DELIVERED", "PICKED_UP"]);

function readFinancialStatus(value: string | null): FinancialStatus | null {
  return FINANCIAL_STATUSES.find((status) => status === value) ?? null;
}

interface TaskDates {
  readonly requestedDate: IsoDate | null;
  readonly deadline: IsoDate | null;
  readonly dateSource: DateSource;
}

function readDates(order: AgendaOrderNode): TaskDates {
  const requested = parseIsoDate(order.dateSouhaitee?.value);
  const deadline = parseIsoDate(order.dateLimite?.value);
  if (requested !== null || deadline !== null) {
    return { requestedDate: requested, deadline, dateSource: "metachamp" };
  }
  const attrRequested = parseLooseDate(findAttribute(order.customAttributes, CART_ATTRIBUTE_KEYS.requestedDate));
  const attrDeadline = parseLooseDate(findAttribute(order.customAttributes, CART_ATTRIBUTE_KEYS.deadline));
  const found = attrRequested !== null || attrDeadline !== null;
  return { requestedDate: attrRequested, deadline: attrDeadline, dateSource: found ? "attribut" : "aucune" };
}

/** Métachamp de l'app, sinon attribut du panier posé par le thème. */
function readMode(order: AgendaOrderNode): DeliveryMode | null {
  const value = order.mode?.value.trim().toLowerCase();
  if (isDeliveryMode(value)) return value;
  const fromCart = findAttribute(order.customAttributes, CART_ATTRIBUTE_KEYS.mode)?.trim().toLowerCase();
  return isDeliveryMode(fromCart) ? fromCart : null;
}

export function readDeliveryStatus(order: Pick<AgendaOrderNode, "displayFulfillmentStatus" | "fulfillments">): DeliveryStatus {
  const status = order.displayFulfillmentStatus;
  if (status === "PARTIALLY_FULFILLED") return "partielle";
  if (status !== "FULFILLED") return "a_livrer";
  const active = order.fulfillments.filter((fulfillment) => fulfillment.status === "SUCCESS");
  const delivered = active.length > 0 && active.every((f) => f.displayStatus !== null && DELIVERED_DISPLAY.has(f.displayStatus));
  return delivered ? "livree" : "expediee";
}

/** Jour suisse de la dernière expédition réussie (date de remise au client ou à la Poste). */
function readDeliveredOn(order: Pick<AgendaOrderNode, "fulfillments">): IsoDate | null {
  const dates = order.fulfillments
    .filter((fulfillment) => fulfillment.status === "SUCCESS")
    .map((fulfillment) => new Date(fulfillment.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => swissIsoDate(date))
    .sort();
  return dates.at(-1) ?? null;
}

function readCompany(order: AgendaOrderNode): string | null {
  const entity = order.purchasingEntity;
  if (entity?.__typename === "PurchasingCompany" && entity.company !== null) return entity.company.name;
  const company = order.shippingAddress?.company?.trim();
  return company === undefined || company === "" ? null : company;
}

function readIsPro(order: AgendaOrderNode): boolean {
  if (order.purchasingEntity?.__typename === "PurchasingCompany") return true;
  const tags = order.customer?.tags.map((tag) => tag.trim().toLowerCase()) ?? [];
  return tags.some((tag) => PRO_CUSTOMER_TAGS.includes(tag));
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

function readStreet(order: AgendaOrderNode): string | null {
  const parts = [clean(order.shippingAddress?.address1), clean(order.shippingAddress?.address2)].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(", ");
}

function readPhone(order: AgendaOrderNode): string | null {
  return clean(order.shippingAddress?.phone) ?? clean(order.customer?.defaultPhoneNumber?.phoneNumber);
}

/** Lignes retirées de la commande (quantité 0) écartées. */
function readItems(order: AgendaOrderNode): OrderItem[] {
  return order.lineItems.nodes
    .filter((line) => line.currentQuantity > 0)
    .map((line) => ({ name: line.name, quantity: line.currentQuantity }));
}

function readTotalCents(order: AgendaOrderNode): number | null {
  const total = order.currentTotalPriceSet?.shopMoney;
  return total === undefined || total.currencyCode !== "CHF" ? null : decimalToCents(total.amount);
}

function readCustomerName(order: AgendaOrderNode): string {
  const name = order.customer?.displayName.trim() || order.shippingAddress?.name?.trim();
  return name === undefined || name === "" ? "Client sans nom" : name;
}

/** `null` si la commande est annulée ou si son identifiant est illisible. */
export function orderToTask(order: AgendaOrderNode): DeliveryTask | null {
  const orderId = parseGid(order.id, "Order");
  if (orderId === null || order.cancelledAt !== null) return null;
  return {
    orderId,
    name: order.name,
    customerName: readCustomerName(order),
    company: readCompany(order),
    isPro: readIsPro(order),
    street: readStreet(order),
    zip: clean(order.shippingAddress?.zip),
    city: clean(order.shippingAddress?.city),
    phone: readPhone(order),
    note: clean(order.note),
    items: readItems(order),
    totalCents: readTotalCents(order),
    ...readDates(order),
    mode: readMode(order),
    status: readDeliveryStatus(order),
    deliveredOn: readDeliveredOn(order),
    financialStatus: readFinancialStatus(order.displayFinancialStatus),
    paymentTerms: null,
  };
}
