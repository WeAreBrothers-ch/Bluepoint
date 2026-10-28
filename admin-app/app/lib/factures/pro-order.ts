import { parseIsoDate, type IsoDate } from "../metafields/definitions";

/**
 * Commande d'un professionnel et état de son paiement, tels que Shopify les décrit.
 * Un pro est un client marqué « pro » (c'est aussi ce qui donne droit à la remise de 15 %)
 * ou un acheteur rattaché à une entreprise Shopify (B2B).
 */

export const PRO_TAG = "pro";

const COMPANY_ENTITY = "PurchasingCompany";
const PAID_STATUS = "PAID";

export interface ReceiptFacts {
  readonly customerTags: readonly string[];
  /** Type de `purchasingEntity` Shopify (« PurchasingCompany » pour un acheteur d'entreprise). */
  readonly purchasingEntityType: string | null;
  readonly financialStatus: string | null;
  /** Date de livraison souhaitée au panier, quand elle est connue. */
  readonly plannedDeliveryDate: IsoDate | null;
}

export function isProOrder(facts: Pick<ReceiptFacts, "customerTags" | "purchasingEntityType">): boolean {
  const tagged = facts.customerTags.some((tag) => tag.trim().toLowerCase() === PRO_TAG);
  return tagged || facts.purchasingEntityType === COMPANY_ENTITY;
}

export function isFullyPaid(facts: Pick<ReceiptFacts, "financialStatus">): boolean {
  return facts.financialStatus === PAID_STATUS;
}

/** La commande telle que la renvoie la requête de `receipt-query.ts`. */
export interface ReceiptOrderData {
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
  };
}
