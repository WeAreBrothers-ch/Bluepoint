import { logError } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { findQrBankAccount } from "./bank-accounts.server";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { classifyCreateFailure } from "./invoice-errors";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import { interpretInvoiceStatus, todayInZurich } from "./invoice-status";
import { updateInvoice } from "./invoice-update.server";
import { getInvoice } from "./invoices.server";
import type { PaymentType } from "./payment-input";
import { recordPayment } from "./payments.server";
import { downloadDraftInvoicePdf, downloadInvoicePdf } from "./pdf-download.server";
import type { SaleNoteBody } from "./vente-bon-plan";
import { RETRY_HINT, SaleInvoiceError } from "./vente-errors";
import type { SaleInvoiceDocument } from "./vente-facture.server";
import type { SaleInvoiceBody } from "./vente-plan";
import { claimPayment, markInvoice, markPayment, releasePayment, type AbaNinjaSale } from "./vente-repository.server";

/**
 * Fin de la facture née d'un bon : complétée (client, compte QR, dates, conditions), paiement inscrit si la
 * commande est payée (une seule fois : réservé en base AVANT l'envoi), puis son PDF. Jamais d'aperçu à
 * QR pour une commande payée. Rejouable : rien ici ne crée de facture.
 */

export interface SalePayment {
  readonly amountChf: number;
  readonly paymentDate: string;
  readonly paymentType: PaymentType;
  /** Note interne (jamais montrée au client). */
  readonly info: string;
}

export interface SaleConversionRequest {
  readonly sale: AbaNinjaSale;
  /** Le bon aux vins actuels, avec sa date de livraison réelle. */
  readonly note: SaleNoteBody;
  readonly invoice: SaleInvoiceBody;
  readonly payment: SalePayment | null;
}

export type SaleOutcome = Result<SaleInvoiceDocument, SaleInvoiceError>;

export interface SaleReceiver {
  readonly addressUuid: string;
  readonly companyUuid: string;
}

export function receiverOf(sale: AbaNinjaSale): SaleReceiver | null {
  return sale.addressUuid === null || sale.companyUuid === null ? null : { addressUuid: sale.addressUuid, companyUuid: sale.companyUuid };
}

export async function remember(task: Promise<Result<unknown, Error>>, what: string, orderId: string): Promise<boolean> {
  const result = await task;
  if (!result.ok) logError(`Facture du bon AbaNinja : ${what}`, result.error, { orderId });
  return result.ok;
}

function incomplete(label: string, what: string, error: AbaNinjaError): SaleOutcome {
  return failure(new SaleInvoiceError("refusee", `La facture ${label} est faite dans AbaNinja, mais l’app n’a pas pu la compléter (${what}).`, [error.message, RETRY_HINT]));
}

function paymentToCheck(label: string): SaleOutcome {
  return failure(
    new SaleInvoiceError("incertaine", `La facture ${label} est faite dans AbaNinja, mais son paiement n’est pas sûr d’y être inscrit.`, [
      "Regardez le paiement de cette facture dans AbaNinja et inscrivez-le à la main s’il manque, avant de l’envoyer.",
    ]),
  );
}

interface MadeInvoice {
  readonly uuid: string;
  readonly label: string;
  /** AbaNinja la dit déjà payée (paiement inscrit à la main, ou par un essai précédent). */
  readonly alreadyPaid: boolean;
}

function paymentRefused(label: string, error: AbaNinjaError): SaleOutcome {
  return failure(
    new SaleInvoiceError("refusee", `AbaNinja a refusé d’inscrire le paiement de la facture ${label}.`, [
      error.message,
      "Inscrivez le paiement à la main dans AbaNinja, puis touchez « Faire la facture » : l’app verra que la facture est payée.",
    ]),
  );
}

async function sendPayment(config: AbaNinjaConfig, request: SaleConversionRequest, payment: SalePayment, invoice: MadeInvoice, options: CallOptions): Promise<SaleOutcome | null> {
  const { orderId } = request.sale;
  const recorded = await recordPayment(config, { documentUuid: invoice.uuid, ...payment }, options);
  if (recorded.ok) {
    await remember(markPayment(orderId, "inscrit"), "paiement inscrit mais non noté", orderId);
    return null;
  }
  if (classifyCreateFailure(recorded.error) !== "refusee") return paymentToCheck(invoice.label);
  await remember(releasePayment(orderId), "paiement refusé, réservation non rendue", orderId);
  return paymentRefused(invoice.label, recorded.error);
}

/** Inscrit le paiement reçu, une seule fois ; null si la facture peut continuer. */
async function settlePayment(config: AbaNinjaConfig, request: SaleConversionRequest, invoice: MadeInvoice, options: CallOptions): Promise<SaleOutcome | null> {
  const { sale, payment } = request;
  if (payment === null || sale.paymentState === "inscrit") return null;
  if (invoice.alreadyPaid) {
    await remember(markPayment(sale.orderId, "inscrit"), "facture déjà payée, non notée", sale.orderId);
    return null;
  }
  if (sale.paymentState === "incertain") return paymentToCheck(invoice.label);
  const claimed = await claimPayment(sale.orderId);
  if (!claimed.ok) return failure(new SaleInvoiceError("refusee", "La base de l’application ne répond pas : le paiement n’est pas inscrit.", [RETRY_HINT]));
  if (!claimed.value) {
    return failure(new SaleInvoiceError("incertaine", `Le paiement de la facture ${invoice.label} est déjà en train d’être inscrit.`, ["Attendez une minute, puis rechargez la page."]));
  }
  return sendPayment(config, request, payment, invoice, options);
}

async function pdfOf(config: AbaNinjaConfig, invoiceUuid: string, input: AbaNinjaInvoiceInput, paid: boolean, label: string, options: CallOptions) {
  if (paid) {
    const pdf = await downloadInvoicePdf(config, invoiceUuid, options);
    return pdf.ok ? pdf : failure(new SaleInvoiceError("refusee", `Facture ${label} faite et payée dans AbaNinja : téléchargez son PDF depuis AbaNinja.`));
  }
  const preview = await downloadDraftInvoicePdf(config, invoiceUuid, input, options);
  return preview.ok
    ? preview
    : failure(new SaleInvoiceError("refusee", `La facture ${label} est faite dans AbaNinja, mais l’app n’a pas pu récupérer son PDF.`, [preview.error.message, RETRY_HINT]));
}

export async function finishSaleInvoice(config: AbaNinjaConfig, request: SaleConversionRequest, invoiceUuid: string, options: CallOptions = {}): Promise<SaleOutcome> {
  const { sale } = request;
  const receiver = receiverOf(sale);
  if (receiver === null) return failure(new SaleInvoiceError("refusee", "Le bon de livraison n’est pas complet dans l’app : la facture attend.", [RETRY_HINT]));
  const bank = await findQrBankAccount(config, options);
  if (!bank.ok) return incomplete(sale.reference, "compte bancaire de la QR-facture", bank.error);
  const input: AbaNinjaInvoiceInput = { ...request.invoice, receiver, bankAccountUuid: bank.value.uuid };
  const updated = await updateInvoice(config, invoiceUuid, input, options);
  if (!updated.ok) return incomplete(sale.reference, "client, dates, conditions et compte de la QR-facture", updated.error);
  const read = await getInvoice(config, invoiceUuid, options);
  const number = read.ok ? read.value.systemInvoiceNumber : null;
  const label = number ?? sale.reference;
  const alreadyPaid = read.ok && interpretInvoiceStatus(read.value, todayInZurich(new Date())) === "payee";
  const unpaid = await settlePayment(config, request, { uuid: invoiceUuid, label, alreadyPaid }, options);
  if (unpaid !== null) return unpaid;
  await remember(markInvoice(sale.orderId, { state: "creee", invoiceUuid, invoiceNumber: number }), "numéro non noté", sale.orderId);
  const pdf = await pdfOf(config, invoiceUuid, input, request.payment !== null, label, options);
  return pdf.ok ? success({ uuid: invoiceUuid, number, reference: sale.reference, pdf: pdf.value }) : pdf;
}
