import { addDays } from "../agenda/dates";
import { parseIsoDate, type IsoDate } from "../metafields/definitions";

/**
 * Rabais de paiement rapide : 2 % de rabais si la facture est payée dans les 10 jours qui suivent sa date.
 * Le but : inciter les pros à payer tout de suite plutôt qu'à 30 jours. Logique pure, testée sans Shopify.
 */

export const EARLY_PAYMENT_PERCENT = 2;
export const EARLY_PAYMENT_DAYS = 10;

/** Étiquette posée sur la commande Shopify quand le client a payé avec le rabais. */
export const EARLY_PAYMENT_TAG = "rabais-paiement-rapide";

/** Texte de la remise inscrite sur la commande (visible dans le détail de la commande). */
export const EARLY_PAYMENT_DESCRIPTION = `Rabais paiement rapide ${EARLY_PAYMENT_PERCENT} %`;

export interface EarlyPaymentOffer {
  readonly percent: number;
  /** Dernier jour pour profiter du rabais (inclus). */
  readonly deadline: IsoDate;
  /** Montant du rabais, en centimes. */
  readonly discountCents: number;
  /** Montant à payer avec le rabais, en centimes. */
  readonly amountCents: number;
}

/** Le rabais sur un total, arrondi au centime (c'est aussi ce que Shopify calcule). */
export function earlyPaymentAmounts(totalCents: number, percent: number = EARLY_PAYMENT_PERCENT): { discountCents: number; amountCents: number } {
  const discountCents = Math.round((totalCents * percent) / 100);
  return { discountCents, amountCents: totalCents - discountCents };
}

/** Dernier jour du rabais pour une facture faite le `issueDate` ; `null` si la date est illisible. */
export function earlyPaymentDeadline(issueDate: string): IsoDate | null {
  const issued = parseIsoDate(issueDate);
  return issued === null ? null : addDays(issued, EARLY_PAYMENT_DAYS);
}

/**
 * Le rabais proposé aujourd'hui pour cette facture, ou `null` : déjà payée (reçu), délai de 10 jours passé,
 * échéance dans les 10 jours (payer à l'échéance serait déjà « rapide »), date ou total illisibles.
 */
export function earlyPaymentOffer(
  invoice: { readonly issueDate: string; readonly dueDate: string; readonly totalCents: number; readonly paidOn: string | null },
  today: IsoDate,
): EarlyPaymentOffer | null {
  if (invoice.paidOn !== null || invoice.totalCents <= 0) return null;
  const deadline = earlyPaymentDeadline(invoice.issueDate);
  if (deadline === null || today > deadline || invoice.dueDate <= deadline) return null;
  return { percent: EARLY_PAYMENT_PERCENT, deadline, ...earlyPaymentAmounts(invoice.totalCents) };
}
