import { paidGatewayOf } from "../abaninja/vente-paiement";
import { findSale } from "../abaninja/vente-repository.server";
import { logError } from "../core/logger.server";
import { failure, type Result } from "../core/result";
import { ensureAbaNinjaTestInvoice, type AbaNinjaSaleContext } from "./abaninja-facture.server";
import { goesToAbaNinja } from "./abaninja-lines";
import { ensureAbaNinjaSaleInvoice } from "./abaninja-vente.server";
import type { EnsuredInvoice } from "./ensured";
import { InvoiceError } from "./errors";
import type { InvoicePayment } from "./order-payment";

/**
 * Aiguillage des commandes d'essai vers AbaNinja (null : la facture BluePoint habituelle) :
 * - un bon de livraison existe (même à vérifier) : la facture naît de ce bon, jamais une deuxième facture à côté ;
 * - pas de bon (ou bon refusé, rien dans AbaNinja) et commande à payer : facture directe dans AbaNinja, comme avant.
 */
export async function ensureViaAbaNinja(ctx: AbaNinjaSaleContext, payment: InvoicePayment): Promise<Result<EnsuredInvoice, InvoiceError> | null> {
  if (payment.kind === "bloquee" || !goesToAbaNinja(ctx.source)) return null;
  const sale = await findSale(ctx.orderId);
  if (!sale.ok) {
    logError("Vente AbaNinja illisible", sale.error, { orderId: ctx.orderId });
    return failure(new InvoiceError("erreur_interne"));
  }
  const row = sale.value;
  if (row !== null && row.shop === ctx.shop && row.noteState !== "refuse") {
    const paid = payment.kind === "payee" ? { paidOn: payment.paidOn, gateway: paidGatewayOf(ctx.source.contact.transactions) } : null;
    return ensureAbaNinjaSaleInvoice(row, ctx, paid);
  }
  return payment.kind === "a_payer" ? ensureAbaNinjaTestInvoice(ctx) : null;
}
