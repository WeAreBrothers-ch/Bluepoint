import { FactureError, mapShopifyOrderToInvoiceInput, type InvoiceInput, type ShopifyOrderForInvoice } from "@bluepoint/facture-qr";
import { FICTITIOUS_TAG } from "../abaninja/bl-essai-order";
import { failure, success, type Result } from "../core/result";
import { toInvoiceSeller } from "../reglages/seller";
import type { ShopSettingsValues } from "../reglages/schema";
import { InvoiceError } from "./errors";
import type { InvoiceContactOrder } from "./order-query";
import { plainInvoiceProblems } from "./plain-problems";

/**
 * Ce qui décide qu'une commande passe par AbaNinja, et ses lignes (mêmes prix, même TVA, même total que
 * la facture BluePoint). Fonctions pures.
 */

/** Numéro provisoire, jamais imprimé : le moteur de facture exige un chiffre (pour la référence QR) ; AbaNinja donne le vrai. */
const PLACEHOLDER_NUMBER = "ABANINJA-1";

/** Commande d'essai : étiquette « fictif » sur la commande, ou sur le client (une commande passée sur le site n'hérite pas de ses étiquettes). */
export function isTestOrder(orderTags: readonly string[], customerTags: readonly string[] | undefined): boolean {
  return orderTags.includes(FICTITIOUS_TAG) || (customerTags ?? []).includes(FICTITIOUS_TAG);
}

export function goesToAbaNinja(source: { readonly contact: Pick<InvoiceContactOrder, "tags" | "customer"> }): boolean {
  return isTestOrder(source.contact.tags, source.contact.customer?.tags);
}

export function abaNinjaLinesOf(
  order: ShopifyOrderForInvoice,
  settings: ShopSettingsValues,
  dates: { readonly issueDate: string; readonly deliveryDate: string },
): Result<InvoiceInput, InvoiceError> {
  try {
    const meta = { invoiceNumber: PLACEHOLDER_NUMBER, ...dates, paymentTermDays: settings.paymentTermDays };
    return success(mapShopifyOrderToInvoiceInput(order, toInvoiceSeller(settings), meta));
  } catch (error) {
    if (!(error instanceof FactureError)) throw error;
    const problems = error.details.length > 0 ? error.details : [error.message];
    return failure(new InvoiceError("donnees_invalides", plainInvoiceProblems(problems)));
  }
}
