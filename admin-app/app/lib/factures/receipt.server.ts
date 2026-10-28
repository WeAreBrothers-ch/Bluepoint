import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import type { OrderGid } from "../shopify/ids";
import { ensureReceipt } from "./generate.server";
import { isFullyPaid, isProOrder } from "./pro-order";
import { fetchReceiptFacts } from "./receipt-query";
import { emailInvoice } from "./send.server";

/**
 * Reçu pro : quand un professionnel paie sa commande en ligne (webhook orders/paid), l'app crée
 * la facture acquittée et l'envoie par e-mail. Les commandes des particuliers sont ignorées.
 * Idempotent : Shopify peut renvoyer le même webhook, et on n'envoie le reçu qu'à sa création.
 * Un échec est journalisé sans bloquer le webhook ; le reçu reste envoyable depuis « Factures ».
 */
export async function issueReceiptOnPayment(admin: AdminApiContext, shop: string, orderId: OrderGid): Promise<void> {
  const facts = await fetchReceiptFacts(admin, orderId);
  if (!facts.ok) {
    logError("Reçu pro : lecture de la commande impossible", facts.error, { orderId, code: facts.error.code });
    return;
  }
  if (!isProOrder(facts.value) || !isFullyPaid(facts.value)) {
    logInfo("Reçu pro ignoré : commande non pro ou non soldée", { orderId });
    return;
  }
  const receipt = await ensureReceipt(admin, shop, orderId, facts.value.plannedDeliveryDate);
  if (!receipt.ok) {
    logError("Reçu pro non créé", receipt.error, { orderId, code: receipt.error.code });
    return;
  }
  if (!receipt.value.created) return;
  const { invoice } = receipt.value;
  const sent = await emailInvoice(shop, invoice.id);
  if (!sent.ok) {
    logError("Reçu pro créé mais e-mail non envoyé", sent.error, { orderId, number: invoice.number, code: sent.error.code });
    return;
  }
  logInfo("Reçu pro envoyé", { orderId, number: invoice.number });
}
