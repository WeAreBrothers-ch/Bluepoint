import type { PaymentTransaction } from "../factures/order-payment";
import type { PaymentType } from "./payment-input";

/**
 * Type du paiement inscrit sur la facture AbaNinja, d'après le moyen de paiement Shopify. Logique pure.
 * « BANK » n'est jamais choisi : AbaNinja exige alors l'IBAN du compte crédité, que l'app ne connaît pas.
 * Un moyen inconnu (payé à la main, virement…) est inscrit en espèces ; son nom reste dans la note interne.
 */

const CARD_GATEWAYS: ReadonlySet<string> = new Set(["shopify_payments", "stripe", "bogus"]);

export function paymentTypeOf(gateway: string): PaymentType {
  const name = gateway.trim().toLowerCase();
  if (CARD_GATEWAYS.has(name)) return "DEBIT_CREDIT_CARD";
  if (name.includes("twint")) return "TWINT";
  if (name.includes("paypal")) return "PAYPAL";
  return "CASH";
}

/** Moyen du dernier paiement réussi (vente ou capture), ou « inconnu ». */
export function paidGatewayOf(transactions: readonly PaymentTransaction[]): string {
  const paid = transactions.filter((t) => (t.kind === "SALE" || t.kind === "CAPTURE") && t.status === "SUCCESS");
  const gateway = paid.at(-1)?.gateway?.trim() ?? "";
  return gateway === "" ? "inconnu" : gateway;
}
