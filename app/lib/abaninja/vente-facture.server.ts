import { logError, logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { createAddress } from "./addresses.server";
import { findQrBankAccount } from "./bank-accounts.server";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { deleteCompany } from "./invoice-cleanup.server";
import { classifyCreateFailure, type CreateInvoiceError } from "./invoice-errors";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import { createInvoice } from "./invoices.server";
import { downloadDraftInvoicePdf } from "./pdf-download.server";
import type { InvoiceReceiver } from "./receiver";
import { markCreated, markRefused, markUncertain } from "./repository.server";
import { ERASE_HINT, SaleInvoiceError } from "./vente-errors";
import type { SaleInvoicePlan } from "./vente-plan";
import { claimSaleInvoice } from "./vente-verrou.server";

/**
 * « J'ai livré » sur une commande fictive : la facture est faite dans AbaNinja (client d'essai, puis
 * facture en brouillon), puis son PDF est rapporté pour que l'app la montre et qu'Eliott l'envoie.
 * Rien n'est envoyé à personne ici. Jamais de rejeu : AbaNinja ne protège pas des doublons.
 */

export interface SaleInvoiceRequest {
  readonly shop: string;
  readonly orderId: string;
  readonly orderName: string;
  readonly plan: SaleInvoicePlan;
}

export interface SaleInvoiceDocument {
  readonly uuid: string;
  /** Numéro donné par AbaNinja ; null s'il n'en donne pas encore au brouillon. */
  readonly number: string | null;
  readonly reference: string;
  readonly pdf: Uint8Array;
}

type Outcome = Result<SaleInvoiceDocument, SaleInvoiceError>;

async function settle(task: Promise<Result<unknown, Error>>, what: string, orderId: string): Promise<void> {
  const result = await task;
  if (!result.ok) logError(`Facture AbaNinja : ${what}`, result.error, { orderId });
}

async function refuse(orderId: string, code: string, message: string, details: readonly string[]): Promise<Outcome> {
  await settle(markRefused(orderId, code), "verrou non libéré", orderId);
  return failure(new SaleInvoiceError("refusee", message, details));
}

async function clientFailed(request: SaleInvoiceRequest, error: AbaNinjaError): Promise<Outcome> {
  if (classifyCreateFailure(error) === "refusee") {
    return refuse(request.orderId, "adresse", "AbaNinja n’a pas créé le client d’essai.", [error.message]);
  }
  await settle(markUncertain(request.orderId, "client_incertain"), "verrou non mis à jour", request.orderId);
  return failure(
    new SaleInvoiceError("incertaine", "AbaNinja n’a pas confirmé la création du client d’essai.", [
      `S’il apparaît dans AbaNinja un client « ${request.plan.clientName} », supprimez-le.`,
      ERASE_HINT,
    ]),
  );
}

async function invoiceFailed(config: AbaNinjaConfig, request: SaleInvoiceRequest, receiver: InvoiceReceiver, error: CreateInvoiceError): Promise<Outcome> {
  logInfo("Facture AbaNinja non créée", { orderId: request.orderId, outcome: error.outcome, status: error.status ?? null });
  if (error.outcome === "incertaine") {
    await settle(markUncertain(request.orderId, error.code), "verrou non mis à jour", request.orderId);
    return failure(
      new SaleInvoiceError("incertaine", "AbaNinja n’a pas confirmé la facture.", [
        `Regardez dans AbaNinja si une facture de référence ${request.plan.reference} existe.`,
        ERASE_HINT,
      ]),
    );
  }
  const removed = "companyUuid" in receiver ? (await deleteCompany(config, receiver.companyUuid)).ok : false;
  const leftover = removed
    ? "Le client d’essai a été retiré d’AbaNinja : il ne reste rien."
    : `Le client d’essai « ${request.plan.clientName} » reste dans AbaNinja : supprimez-le à la main.`;
  return refuse(request.orderId, error.code, "AbaNinja a refusé la facture.", [error.message, leftover]);
}

async function recordCreated(request: SaleInvoiceRequest, uuid: string, number: string | null): Promise<Result<void, SaleInvoiceError>> {
  const saved = await markCreated(request.orderId, { invoiceUuid: uuid, systemInvoiceNumber: number ?? "" });
  if (saved.ok) return success(undefined);
  logError("Facture AbaNinja créée mais non notée", saved.error, { orderId: request.orderId });
  await settle(markUncertain(request.orderId, "creation_non_notee"), "verrou non mis à jour", request.orderId);
  return failure(
    new SaleInvoiceError("incertaine", "La facture est faite dans AbaNinja, mais l’app n’a pas pu le noter.", [
      `Référence dans AbaNinja : ${request.plan.reference}.`,
      ERASE_HINT,
    ]),
  );
}

async function fetchPdf(config: AbaNinjaConfig, uuid: string, label: string, input: AbaNinjaInvoiceInput, options: CallOptions) {
  const pdf = await downloadDraftInvoicePdf(config, uuid, input, options);
  if (pdf.ok) return pdf;
  return failure(new SaleInvoiceError("refusee", `La facture ${label} est faite dans AbaNinja, mais l’app n’a pas pu récupérer son PDF.`, [pdf.error.message, ERASE_HINT]));
}

export async function createTestSaleInvoice(config: AbaNinjaConfig, request: SaleInvoiceRequest, options: CallOptions = {}): Promise<Outcome> {
  const { orderId, plan } = request;
  const claimed = await claimSaleInvoice({ shop: request.shop, orderId, orderName: request.orderName, reference: plan.reference, isTest: true });
  if (!claimed.ok) return claimed;
  const bank = await findQrBankAccount(config, options);
  if (!bank.ok) return refuse(orderId, "compte_bancaire", "AbaNinja n’a pas donné le compte bancaire de la QR-facture.", [bank.error.message]);
  const receiver = await createAddress(config, plan.clientAddress, { ...options, force: true });
  if (!receiver.ok) return clientFailed(request, receiver.error);
  const input: AbaNinjaInvoiceInput = { ...plan.invoice, receiver: receiver.value, bankAccountUuid: bank.value.uuid };
  const created = await createInvoice(config, input, options);
  if (!created.ok) return invoiceFailed(config, request, receiver.value, created.error);
  const { uuid, systemInvoiceNumber: number } = created.value;
  const recorded = await recordCreated(request, uuid, number);
  if (!recorded.ok) return recorded;
  logInfo("Facture AbaNinja créée", { orderId, number });
  const pdf = await fetchPdf(config, uuid, number ?? plan.reference, input, options);
  return pdf.ok ? success({ uuid, number, reference: plan.reference, pdf: pdf.value }) : pdf;
}
