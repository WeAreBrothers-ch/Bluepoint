import { daysBetween } from "../agenda/dates";
import type { IsoDate } from "../metafields/definitions";
import { parseIsoDate } from "../metafields/definitions";

/** Où en est le paiement d'une facture, et comment le client a payé (logique pure). */

export type PaymentState = "payee" | "a_payer" | "en_retard";

export interface PaymentSituation {
  readonly state: PaymentState;
  /** Jours de retard après l'échéance (0 si pas en retard). */
  readonly overdueDays: number;
}

/** Statuts Shopify (`displayFinancialStatus`) qui veulent dire « plus rien à encaisser ». */
const SETTLED = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "VOIDED"]);

/**
 * Un reçu pro (`paidOn`) est payé ; sinon le statut de la commande Shopify fait foi.
 * Statut inconnu (commande illisible) : on la considère à payer, pour ne jamais cacher une dette.
 */
export function paymentSituation(
  invoice: { readonly paidOn: string | null; readonly dueDate: string },
  financialStatus: string | null,
  today: IsoDate,
): PaymentSituation {
  if (invoice.paidOn !== null || (financialStatus !== null && SETTLED.has(financialStatus))) {
    return { state: "payee", overdueDays: 0 };
  }
  const due = parseIsoDate(invoice.dueDate);
  const late = due === null ? 0 : daysBetween(due, today);
  return late > 0 ? { state: "en_retard", overdueDays: late } : { state: "a_payer", overdueDays: 0 };
}

/** Comment le client a payé : noté en étiquette sur la commande Shopify (« paiement-twint »). */
export const PAYMENT_METHODS = ["virement", "cash", "twint"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  virement: "Virement",
  cash: "Cash",
  twint: "TWINT",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function paymentMethodTag(method: PaymentMethod): string {
  return `paiement-${method}`;
}
