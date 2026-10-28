import { longDay, swissIsoDate } from "../agenda/dates";
import { deliveryDateText } from "../agenda/labels";
import { orderToTask } from "../agenda/mapping";
import { AGENDA_ORDER_FIELDS, type AgendaOrderNode } from "../agenda/query";
import type { PaymentTermsInfo, ScheduledTask } from "../agenda/types";
import { scheduleTask } from "../agenda/urgency";
import { decimalToCents } from "../commande/totals";
import type { IsoDate } from "../metafields/definitions";

/**
 * Fiche d'une commande dans l'app (à la place de la page de commande Shopify) :
 * quand et comment, le client, les vins avec leurs prix, la remise, le total. Logique pure.
 */

export const ORDER_DETAIL_QUERY = `#graphql
query FicheCommande($id: ID!) {
  order(id: $id) {${AGENDA_ORDER_FIELDS}
      createdAt
      email
      customer { defaultEmailAddress { emailAddress } }
      currentTotalDiscountsSet { shopMoney { amount } }
      currentShippingPriceSet { shopMoney { amount } }
      currentTotalTaxSet { shopMoney { amount } }
      discountApplications(first: 5) {
        nodes {
          __typename
          ... on AutomaticDiscountApplication { title }
          ... on ManualDiscountApplication { title }
          ... on DiscountCodeApplication { code }
        }
      }
      detailLines: lineItems(first: 50) {
        nodes { id name currentQuantity variant { id } originalUnitPriceSet { shopMoney { amount } } discountedTotalSet { shopMoney { amount } } }
      }
  }
}`;

interface Money {
  readonly shopMoney: { readonly amount: string };
}

export interface OrderDetailNode extends Omit<AgendaOrderNode, "customer"> {
  readonly customer: (NonNullable<AgendaOrderNode["customer"]> & { readonly defaultEmailAddress?: { readonly emailAddress: string } | null }) | null;
  readonly createdAt: string;
  readonly email: string | null;
  readonly currentTotalDiscountsSet: Money | null;
  readonly currentShippingPriceSet: Money | null;
  readonly currentTotalTaxSet: Money | null;
  readonly discountApplications: {
    readonly nodes: readonly { readonly __typename: string; readonly title?: string; readonly code?: string }[];
  };
  readonly detailLines: {
    readonly nodes: readonly {
      readonly id: string;
      readonly name: string;
      readonly currentQuantity: number;
      readonly variant: { readonly id: string } | null;
      readonly originalUnitPriceSet: Money | null;
      readonly discountedTotalSet: Money | null;
    }[];
  };
}

export interface OrderDetailLine {
  readonly lineItemId: string;
  /** `null` : article sans variante (ajouté à la main dans Shopify), pas modifiable ici. */
  readonly variantId: string | null;
  readonly name: string;
  readonly quantity: number;
  readonly unitCents: number | null;
  readonly totalCents: number | null;
}

export interface OrderDetail {
  readonly task: ScheduledTask;
  /** Ex. « À livrer demain (jeudi 29 octobre) », « Livrée le mercredi 28 octobre ». */
  readonly headline: string;
  readonly late: boolean;
  /** Ex. « Commandée le mardi 27 octobre ». */
  readonly orderedLabel: string;
  readonly email: string | null;
  readonly lines: readonly OrderDetailLine[];
  /** Somme des lignes, avant la remise sur la commande. */
  readonly winesCents: number | null;
  readonly discountCents: number;
  /** Ex. « Prix pro -15 % », « Remise ». */
  readonly discountLabel: string;
  readonly shippingCents: number;
  readonly taxCents: number | null;
  readonly totalCents: number | null;
}

const cents = (money: Money | null): number | null => decimalToCents(money?.shopMoney.amount);

const VERB_BY_MODE = { livraison: "À livrer", poste: "À envoyer", retrait: "À préparer pour le retrait" } as const;

function headline(task: ScheduledTask, today: IsoDate): string {
  if (task.status === "livree") return task.deliveredOn === null ? "Livrée" : `Livrée le ${longDay(task.deliveredOn)}`;
  if (task.status === "expediee") return "Partie : en route vers le client";
  if (task.urgency === "sans_date") return "Jour de livraison pas encore choisi";
  const text = deliveryDateText(task, today);
  return task.mode === null ? text : text.replace(/^À livrer/, VERB_BY_MODE[task.mode]);
}

function discountLabel(node: OrderDetailNode): string {
  const titles = node.discountApplications.nodes
    .map((application) => application.title ?? application.code ?? "")
    .filter((title) => title.trim() !== "");
  return titles.length === 0 ? "Remise" : [...new Set(titles)].join(", ");
}

/** `null` : commande annulée ou illisible. */
export function toOrderDetail(node: OrderDetailNode, paymentTerms: PaymentTermsInfo | null, today: IsoDate): OrderDetail | null {
  const base = orderToTask({ ...node, customer: node.customer });
  if (base === null) return null;
  const task = scheduleTask({ ...base, paymentTerms }, today);
  const lines = node.detailLines.nodes
    .filter((line) => line.currentQuantity > 0)
    .map((line) => ({
      lineItemId: line.id,
      variantId: line.variant?.id ?? null,
      name: line.name,
      quantity: line.currentQuantity,
      unitCents: cents(line.originalUnitPriceSet),
      totalCents: cents(line.discountedTotalSet),
    }));
  const winesCents = lines.every((line) => line.totalCents !== null)
    ? lines.reduce((sum, line) => sum + (line.totalCents ?? 0), 0)
    : null;
  const created = new Date(node.createdAt);
  return {
    task,
    headline: headline(task, today),
    late: task.status !== "livree" && task.urgency === "en_retard",
    orderedLabel: Number.isNaN(created.getTime()) ? "" : `Commandée le ${longDay(swissIsoDate(created))}`,
    email: node.email?.trim() || node.customer?.defaultEmailAddress?.emailAddress.trim() || null,
    lines,
    winesCents,
    discountCents: cents(node.currentTotalDiscountsSet) ?? 0,
    discountLabel: discountLabel(node),
    shippingCents: cents(node.currentShippingPriceSet) ?? 0,
    taxCents: cents(node.currentTotalTaxSet),
    totalCents: task.totalCents,
  };
}
