import { parseIsoDate, type IsoDate } from "../metafields/definitions";
import { isTestOrder } from "./abaninja-lines";
import { hasProTag } from "./pro-tag";

/**
 * Commande d'un professionnel et état de son paiement, tels que Shopify les décrit.
 * Un pro est un client marqué « pro » (c'est aussi ce qui donne droit aux prix pro)
 * ou un acheteur rattaché à une entreprise Shopify (B2B).
 */

const COMPANY_ENTITY = "PurchasingCompany";
const PAID_STATUS = "PAID";

export interface ReceiptFacts {
  readonly customerTags: readonly string[];
  /** Type de `purchasingEntity` Shopify (« PurchasingCompany » pour un acheteur d'entreprise). */
  readonly purchasingEntityType: string | null;
  readonly financialStatus: string | null;
  /** Date de livraison souhaitée au panier, quand elle est connue. */
  readonly plannedDeliveryDate: IsoDate | null;
  /** Commande d'essai (« fictif ») : sa facture naît de son bon de livraison AbaNinja. */
  readonly isTest: boolean;
}

export function isProOrder(facts: Pick<ReceiptFacts, "customerTags" | "purchasingEntityType">): boolean {
  return hasProTag(facts.customerTags) || facts.purchasingEntityType === COMPANY_ENTITY;
}

export function isFullyPaid(facts: Pick<ReceiptFacts, "financialStatus">): boolean {
  return facts.financialStatus === PAID_STATUS;
}

/** Pourquoi le reçu pro ne se fait pas ; null : il se fait. */
export function receiptSkipReason(facts: ReceiptFacts): string | null {
  if (facts.isTest) return "commande d’essai, sa facture naît de son bon de livraison AbaNinja";
  if (!isProOrder(facts) || !isFullyPaid(facts)) return "commande non pro ou non soldée";
  return null;
}

/** La commande telle que la renvoie la requête de `receipt-query.ts`. */
export interface ReceiptOrderData {
  readonly tags: readonly string[];
  readonly displayFinancialStatus: string | null;
  readonly customer: { readonly tags: readonly string[] } | null;
  readonly purchasingEntity: { readonly __typename: string } | null;
  readonly dateSouhaitee: { readonly value: string } | null;
}

export function toReceiptFacts(order: ReceiptOrderData): ReceiptFacts {
  return {
    customerTags: order.customer?.tags ?? [],
    purchasingEntityType: order.purchasingEntity?.__typename ?? null,
    financialStatus: order.displayFinancialStatus,
    plannedDeliveryDate: order.dateSouhaitee === null ? null : parseIsoDate(order.dateSouhaitee.value),
    isTest: isTestOrder(order.tags, order.customer?.tags),
  };
}
