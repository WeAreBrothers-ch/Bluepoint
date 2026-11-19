import { logInfo } from "../core/logger.server";
import { failure, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { convertDeliveryNoteToInvoice, listDeliveryNoteActionNames, markDeliveryNoteSent, updateDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { classifyCreateFailure } from "./invoice-errors";
import { finishSaleInvoice, receiverOf, remember, type SaleConversionRequest, type SaleOutcome } from "./vente-conversion-finish.server";
import { SALE_ERASE_HINT, SaleInvoiceError } from "./vente-errors";
import { claimConversion, markInvoice, markNote } from "./vente-repository.server";

export type { SaleConversionRequest, SalePayment } from "./vente-conversion-finish.server";

/**
 * « J'ai livré » sur une commande dont le bon est fait : le bon est remis aux vins actuels, puis AbaNinja le
 * transforme en facture (le bon devient « converti », c'est-à-dire réglé). La transformation est réservée
 * avant (une seule facture, même si le bouton et le webhook arrivent ensemble) et n'est jamais rejouée.
 */

const DATABASE_DOWN = "La base de l’application ne répond pas. Réessayez dans un instant.";

function refused(message: string, details: readonly string[] = []): SaleOutcome {
  return failure(new SaleInvoiceError("refusee", message, details));
}

/** Rien n'a été créé : la réservation est rendue pour qu'un nouvel essai puisse la reprendre. */
async function release(orderId: string, error: AbaNinjaError, message: string): Promise<SaleOutcome> {
  await remember(markInvoice(orderId, { state: "refusee", errorCode: error.code }), "réservation non rendue", orderId);
  return refused(message, [error.message]);
}

/** Si AbaNinja ne transforme pas un brouillon, le bon est d'abord marqué envoyé (rien n'est envoyé à personne). */
async function prepareNote(config: AbaNinjaConfig, noteUuid: string, options: CallOptions): Promise<Result<void, AbaNinjaError> | null> {
  const actions = await listDeliveryNoteActionNames(config, noteUuid, options);
  if (!actions.ok || actions.value.includes("convertDNI") || !actions.value.includes("markSent")) return null;
  logInfo("Bon AbaNinja marqué envoyé avant sa facture", { noteUuid });
  return markDeliveryNoteSent(config, noteUuid, options);
}

async function conversionFailed(request: SaleConversionRequest, error: AbaNinjaError): Promise<SaleOutcome> {
  const { orderId, reference } = request.sale;
  if (classifyCreateFailure(error) === "refusee") return release(orderId, error, "AbaNinja a refusé de transformer le bon de livraison en facture.");
  await remember(markInvoice(orderId, { state: "incertaine", errorCode: error.code }), "état incertain non noté", orderId);
  return failure(
    new SaleInvoiceError("incertaine", "AbaNinja n’a pas confirmé la facture du bon de livraison.", [
      `Regardez dans AbaNinja si le bon de référence ${reference} a déjà sa facture.`,
      SALE_ERASE_HINT,
    ]),
  );
}

export async function convertSaleNote(config: AbaNinjaConfig, request: SaleConversionRequest, options: CallOptions = {}): Promise<SaleOutcome> {
  const { orderId, noteUuid, reference } = request.sale;
  const receiver = receiverOf(request.sale);
  if (noteUuid === null || receiver === null) return refused("Le bon de livraison n’est pas complet dans l’app : la facture n’est pas faite.", [SALE_ERASE_HINT]);
  const claimed = await claimConversion(orderId);
  if (!claimed.ok) return refused(DATABASE_DOWN);
  if (!claimed.value) return refused("La facture de ce bon est déjà faite ou en train de l’être.", ["Attendez une minute, puis rechargez la page."]);
  const updated = await updateDeliveryNote(config, noteUuid, { ...request.note, receiver }, options);
  if (!updated.ok) return release(orderId, updated.error, "AbaNinja n’a pas remis le bon de livraison aux vins actuels : la facture n’est pas faite.");
  const prepared = await prepareNote(config, noteUuid, options);
  if (prepared !== null && !prepared.ok) return release(orderId, prepared.error, "AbaNinja n’a pas préparé le bon de livraison pour sa facture.");
  const converted = await convertDeliveryNoteToInvoice(config, noteUuid, options);
  if (!converted.ok) return conversionFailed(request, converted.error);
  const invoiceUuid = converted.value;
  logInfo("Bon AbaNinja transformé en facture", { orderId, reference, invoiceUuid });
  const noted = await remember(markInvoice(orderId, { state: "creee", invoiceUuid, invoiceNumber: null }), "facture non notée", orderId);
  await remember(markNote(orderId, { state: "converti" }), "bon réglé non noté", orderId);
  if (!noted) {
    return failure(new SaleInvoiceError("incertaine", "La facture est faite dans AbaNinja, mais l’app n’a pas pu le noter.", [`Référence du bon : ${reference}.`, SALE_ERASE_HINT]));
  }
  return finishSaleInvoice(config, request, invoiceUuid, options);
}

/** Facture déjà née du bon (une étape avait échoué) : la compléter et la rapporter, jamais en refaire une. */
export function resumeSaleInvoice(config: AbaNinjaConfig, request: SaleConversionRequest, options: CallOptions = {}): Promise<SaleOutcome> {
  const { invoiceUuid } = request.sale;
  if (invoiceUuid === null) return Promise.resolve(refused("La facture de ce bon est à vérifier dans AbaNinja.", [SALE_ERASE_HINT]));
  return finishSaleInvoice(config, request, invoiceUuid, options);
}
