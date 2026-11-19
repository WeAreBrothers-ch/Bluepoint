import { swissIsoDate } from "../agenda/dates";
import type { IsoDate } from "../metafields/definitions";

/**
 * Quelle facture faire à la livraison, d'après le paiement noté dans Shopify (logique pure).
 * Une QR-facture « payable à N jours » ne part que si le client n'a encore rien payé : sinon il paierait deux fois.
 */

export interface PaymentTransaction {
  /** `SALE`, `CAPTURE`, `AUTHORIZATION`, `REFUND`… */
  readonly kind: string;
  /** `SUCCESS`, `FAILURE`, `PENDING`… */
  readonly status: string;
  readonly processedAt: string | null;
}

export interface OrderPaymentFacts {
  /** `displayFinancialStatus` de la commande Shopify. */
  readonly displayFinancialStatus: string | null;
  readonly transactions: readonly PaymentTransaction[];
}

export type BlockedPaymentCode = "paiement_partiel" | "paiement_a_encaisser" | "commande_remboursee";

export type InvoicePayment =
  | { readonly kind: "a_payer" }
  | { readonly kind: "payee"; readonly paidOn: IsoDate }
  | { readonly kind: "bloquee"; readonly code: BlockedPaymentCode };

/** Tout est encaissé (un remboursement partiel garde une facture acquittée du montant restant). */
const PAID = new Set(["PAID", "PARTIALLY_REFUNDED"]);

const BLOCKED: Readonly<Record<string, BlockedPaymentCode>> = {
  PARTIALLY_PAID: "paiement_partiel",
  AUTHORIZED: "paiement_a_encaisser",
  REFUNDED: "commande_remboursee",
};

/** Jour (en Suisse) du dernier encaissement réussi, ou null si Shopify n'en donne aucun. */
function lastPaymentDate(transactions: readonly PaymentTransaction[]): IsoDate | null {
  const instants = transactions
    .flatMap((t) => ((t.kind === "SALE" || t.kind === "CAPTURE") && t.status === "SUCCESS" && t.processedAt !== null ? [new Date(t.processedAt).getTime()] : []))
    .filter((time) => Number.isFinite(time));
  return instants.length === 0 ? null : swissIsoDate(new Date(Math.max(...instants)));
}

export function invoicePaymentOf(order: OrderPaymentFacts, today: IsoDate): InvoicePayment {
  const status = order.displayFinancialStatus;
  if (status !== null && PAID.has(status)) return { kind: "payee", paidOn: lastPaymentDate(order.transactions) ?? today };
  const blocked = status === null ? undefined : BLOCKED[status];
  return blocked === undefined ? { kind: "a_payer" } : { kind: "bloquee", code: blocked };
}
