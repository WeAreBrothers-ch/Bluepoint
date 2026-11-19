import { z } from "zod";
import { isoDate, singleLine, uuidField } from "./input-validation";

/**
 * Paiement reçu à inscrire sur une facture AbaNinja (spec finances-v2 : `paymentDirection: "IN"`, `processing.type: "receipt"`).
 * « BANK » est exclu : AbaNinja exige alors l'IBAN du compte ; un virement arrive par le rapprochement bancaire d'AbaNinja.
 */

export const PAYMENT_TYPES = ["DEBIT_CREDIT_CARD", "TWINT", "CASH", "PAYPAL"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const paymentInputSchema = z.strictObject({
  documentUuid: uuidField,
  amountChf: z.number().positive().max(1_000_000),
  paymentDate: isoDate,
  paymentType: z.enum(PAYMENT_TYPES),
  /** Note interne (jamais montrée au client), ex. « Payé en ligne (shopify_payments) ». */
  info: singleLine(255),
});

export type PaymentInput = z.input<typeof paymentInputSchema>;

/** Corps de la requête ; `sendPaymentConfirmation: false` : AbaNinja n'écrit jamais au client. */
export function buildPaymentBody(payment: z.output<typeof paymentInputSchema>): object {
  return {
    paymentDirection: "IN",
    paymentType: payment.paymentType,
    amount: payment.amountChf,
    currencyCode: "CHF",
    paymentDate: payment.paymentDate,
    paymentInfo: payment.info,
    processing: { type: "receipt", documentUuid: payment.documentUuid, sendPaymentConfirmation: false },
  };
}
