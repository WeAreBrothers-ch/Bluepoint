import { decimalToCents } from "../../commande/totals";
import type { IsoDate } from "../../metafields/definitions";
import { swissIsoDate } from "../dates";
import type { DetailLineNode, OrderDetailNode } from "./query";

/** Commande Shopify → détail prêt à afficher (montants en centimes, champs vides retirés). */

export interface DetailLine {
  readonly id: string;
  readonly label: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly totalCents: number;
}

export interface OrderDetail {
  readonly name: string;
  readonly createdOn: IsoDate;
  readonly contact: {
    readonly name: string | null;
    readonly email: string | null;
    readonly phone: string | null;
  };
  /** Lignes d'adresse dans l'ordre d'une étiquette postale ; vide si aucune adresse. */
  readonly addressLines: readonly string[];
  readonly lines: readonly DetailLine[];
  readonly linesTruncated: boolean;
  /** Somme des lignes au prix d'origine, avant remise. */
  readonly linesTotalCents: number;
  readonly discountCents: number;
  readonly shippingCents: number;
  readonly taxCents: number;
  readonly taxesIncluded: boolean;
  readonly totalCents: number;
  readonly outstandingCents: number;
  readonly paymentTerms: { readonly name: string; readonly dueOn: IsoDate | null } | null;
  readonly note: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** Montant illisible → 0 : un champ abîmé ne doit pas empêcher d'afficher le reste. */
function cents(amount: string): number {
  return decimalToCents(amount) ?? 0;
}

function toLine(node: DetailLineNode): DetailLine {
  const variant = clean(node.variantTitle);
  const unitCents = cents(node.originalUnitPriceSet.shopMoney.amount);
  return {
    id: node.id,
    label: variant === null || variant === "Default Title" ? node.title : `${node.title} — ${variant}`,
    quantity: node.quantity,
    unitCents,
    totalCents: unitCents * node.quantity,
  };
}

function addressLines(address: OrderDetailNode["shippingAddress"]): string[] {
  if (address === null) return [];
  const town = [clean(address.zip), clean(address.city)].filter((part) => part !== null).join(" ");
  return [address.company, address.name, address.address1, address.address2, town]
    .map(clean)
    .filter((line): line is string => line !== null);
}

function dateOf(timestamp: string | null | undefined): IsoDate | null {
  if (timestamp === null || timestamp === undefined) return null;
  const instant = new Date(timestamp);
  return Number.isNaN(instant.getTime()) ? null : swissIsoDate(instant);
}

function paymentTerms(terms: OrderDetailNode["paymentTerms"]): OrderDetail["paymentTerms"] {
  if (terms === null) return null;
  return { name: terms.paymentTermsName, dueOn: dateOf(terms.paymentSchedules.nodes[0]?.dueAt) };
}

export function toOrderDetail(order: OrderDetailNode): OrderDetail {
  const lines = order.lineItems.nodes.map(toLine);
  return {
    name: order.name,
    createdOn: dateOf(order.createdAt) ?? swissIsoDate(new Date()),
    contact: {
      name: clean(order.customer?.displayName) ?? clean(order.shippingAddress?.name),
      email: clean(order.customer?.email) ?? clean(order.email),
      phone: clean(order.customer?.phone) ?? clean(order.phone) ?? clean(order.shippingAddress?.phone),
    },
    addressLines: addressLines(order.shippingAddress),
    lines,
    linesTruncated: order.lineItems.pageInfo.hasNextPage,
    linesTotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    discountCents: cents(order.totalDiscountsSet.shopMoney.amount),
    shippingCents: cents(order.totalShippingPriceSet.shopMoney.amount),
    taxCents: cents(order.totalTaxSet.shopMoney.amount),
    taxesIncluded: order.taxesIncluded,
    totalCents: cents(order.totalPriceSet.shopMoney.amount),
    outstandingCents: cents(order.totalOutstandingSet.shopMoney.amount),
    paymentTerms: paymentTerms(order.paymentTerms),
    note: clean(order.note),
  };
}
