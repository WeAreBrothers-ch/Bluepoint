import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { findSale } from "../abaninja/vente-repository.server";
import { logError, logInfo } from "../core/logger.server";
import type { OrderGid } from "../shopify/ids";
import { ensureReceipt } from "./generate.server";
import { receiptSkipReason } from "./pro-order";
import { fetchReceiptFacts } from "./receipt-query";
import { emailInvoice } from "./send.server";

/**
 * Étiquette « fictif » retirée après coup : la ligne d'essai garde le bon, et la facture en naîtra à la
 * livraison. Base illisible : pas de reçu non plus (jamais une facture de trop ; il reste faisable depuis « Factures »).
 */
async function testNoteReason(shop: string, orderId: OrderGid): Promise<string | null> {
  const sale = await findSale(orderId);
  if (!sale.ok) {
    logError("Reçu pro : vente AbaNinja illisible", sale.error, { orderId });
    return "vente AbaNinja illisible, le reçu reste faisable depuis « Factures »";
  }
  const row = sale.value;
  const followsNote = row !== null && row.shop === shop && row.isTest && row.noteState !== "refuse";
  return followsNote ? "commande d’essai (étiquette retirée), sa facture naît de son bon de livraison AbaNinja" : null;
}

/**
 * Reçu pro : quand un professionnel paie sa commande en ligne (webhook orders/paid), l'app crée
 * la facture acquittée et l'envoie par e-mail. Les commandes des particuliers sont ignorées, et celles
 * d'essai aussi : leur facture naît de leur bon de livraison AbaNinja à la livraison.
 * Idempotent : Shopify peut renvoyer le même webhook, et on n'envoie le reçu qu'à sa création.
 * Un échec est journalisé sans bloquer le webhook ; le reçu reste envoyable depuis « Factures ».
 */
export async function issueReceiptOnPayment(admin: AdminApiContext, shop: string, orderId: OrderGid): Promise<void> {
  const facts = await fetchReceiptFacts(admin, orderId);
  if (!facts.ok) {
    logError("Reçu pro : lecture de la commande impossible", facts.error, { orderId, code: facts.error.code });
    return;
  }
  const skipped = receiptSkipReason(facts.value) ?? (await testNoteReason(shop, orderId));
  if (skipped !== null) {
    logInfo(`Reçu pro ignoré : ${skipped}`, { orderId });
    return;
  }
  const receipt = await ensureReceipt(admin, shop, orderId, facts.value.plannedDeliveryDate);
  if (!receipt.ok) {
    logError("Reçu pro non créé", receipt.error, { orderId, code: receipt.error.code });
    return;
  }
  if (!receipt.value.created) return;
  const { invoice } = receipt.value;
  const sent = await emailInvoice(admin, shop, invoice.id);
  if (!sent.ok) {
    logError("Reçu pro créé mais e-mail non envoyé", sent.error, { orderId, number: invoice.number, code: sent.error.code });
    return;
  }
  logInfo("Reçu pro envoyé", { orderId, number: invoice.number });
}
