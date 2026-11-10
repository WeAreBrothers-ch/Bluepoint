import { logError } from "../core/logger.server";
import type { Result } from "../core/result";
import { createAddress } from "./addresses.server";
import { createInvoice, type CreatedInvoice } from "./invoices.server";
import { classifyCreateFailure, type CreateInvoiceError } from "./invoice-errors";
import type { AbaNinjaError } from "./errors";
import type { InvoiceReceiver } from "./receiver";
import { markCreated, markRefused, markUncertain } from "./repository.server";
import { trialAddress, trialInvoice, TRIAL_CLIENT_NAME } from "./trial-fixtures";
import type { TrialContext, TrialLog } from "./trial-types";

/** Étape 4 : le client fictif, puis la facture brouillon de 1 CHF. Jamais de rejeu, jamais d'envoi. */

export interface CreatedDocuments {
  readonly companyUuid: string | null;
  readonly invoiceUuid: string | null;
  readonly invoiceNumber: string | null;
  /** Le client ou la facture a peut-être été créé sans qu'on le sache : on ne supprime rien de nous-mêmes. */
  readonly uncertain: boolean;
  /** Le client existe peut-être alors que son identifiant est inconnu (il faut le chercher à la main). */
  readonly clientMaybeCreated: boolean;
}

const NOTHING: CreatedDocuments = { companyUuid: null, invoiceUuid: null, invoiceNumber: null, uncertain: false, clientMaybeCreated: false };

const DUPLICATE_HELP = `Un client d’essai existe déjà dans AbaNinja (reste d’un essai précédent). Supprimez le client « ${TRIAL_CLIENT_NAME} » dans AbaNinja, puis réessayez.`;
const CLIENT_UNCERTAIN = `Le client fictif a peut-être été créé : le résultat est incertain. Cherchez le client « ${TRIAL_CLIENT_NAME} » dans AbaNinja et supprimez-le s’il existe.`;

type ClientStep = { readonly receiver: InvoiceReceiver } | { readonly stop: CreatedDocuments };

function noteDatabaseFailure(result: Result<unknown, Error>, what: string, ctx: TrialContext): void {
  if (!result.ok) logError(`Essai AbaNinja : ${what}`, result.error, { shop: ctx.shop });
}

function companyOf(receiver: InvoiceReceiver): string | null {
  return "companyUuid" in receiver ? receiver.companyUuid : null;
}

async function stopAfterClientFailure(ctx: TrialContext, log: TrialLog, error: AbaNinjaError): Promise<ClientStep> {
  if (classifyCreateFailure(error) === "incertaine") {
    noteDatabaseFailure(await markUncertain(ctx.orderId, "client_incertain"), "verrou non mis à jour", ctx);
    log.fail("creation", `${CLIENT_UNCERTAIN} (${error.message})`);
    return { stop: { ...NOTHING, uncertain: true, clientMaybeCreated: true } };
  }
  noteDatabaseFailure(await markRefused(ctx.orderId, "adresse"), "verrou non libéré", ctx);
  log.fail("creation", error.status === 409 ? DUPLICATE_HELP : `Le client fictif n’a pas été créé. ${error.message}`);
  return { stop: NOTHING };
}

async function createTrialClient(ctx: TrialContext, log: TrialLog): Promise<ClientStep> {
  const address = await createAddress(ctx.config, trialAddress(), ctx.call);
  return address.ok ? { receiver: address.value } : stopAfterClientFailure(ctx, log, address.error);
}

/** Note la facture créée ; si la base n'y arrive pas, le verrou passe en « incertaine » plutôt que de rester « en cours ». */
async function recordCreated(ctx: TrialContext, log: TrialLog, created: CreatedInvoice): Promise<void> {
  const number = created.systemInvoiceNumber ?? "";
  const saved = await markCreated(ctx.orderId, { invoiceUuid: created.uuid, systemInvoiceNumber: number });
  noteDatabaseFailure(saved, "facture créée mais non notée", ctx);
  if (saved.ok) {
    log.ok("creation", `Client fictif et facture d’essai de 1 CHF créés en brouillon${number === "" ? "" : ` (n° ${number})`}.`);
    return;
  }
  noteDatabaseFailure(await markUncertain(ctx.orderId, "creation_non_notee"), "verrou non mis à jour", ctx);
  log.fail("creation", "La facture d’essai a été créée, mais la base de l’application n’a pas pu le noter. L’essai s’arrête ici.");
}

async function recordInvoiceFailure(ctx: TrialContext, log: TrialLog, error: CreateInvoiceError): Promise<boolean> {
  const uncertain = error.outcome === "incertaine";
  const marked = uncertain ? await markUncertain(ctx.orderId, error.code) : await markRefused(ctx.orderId, error.code);
  noteDatabaseFailure(marked, "verrou non mis à jour", ctx);
  log.fail("creation", error.message);
  return uncertain;
}

export async function createTrialDocuments(ctx: TrialContext, log: TrialLog, bankAccountUuid: string): Promise<CreatedDocuments> {
  const client = await createTrialClient(ctx, log);
  if ("stop" in client) return client.stop;
  const companyUuid = companyOf(client.receiver);
  const input = trialInvoice(client.receiver, bankAccountUuid, ctx.reference, ctx.now);
  const invoice = await createInvoice(ctx.config, input, ctx.call);
  if (!invoice.ok) {
    const uncertain = await recordInvoiceFailure(ctx, log, invoice.error);
    return { ...NOTHING, companyUuid, uncertain };
  }
  await recordCreated(ctx, log, invoice.value);
  return { ...NOTHING, companyUuid, invoiceUuid: invoice.value.uuid, invoiceNumber: invoice.value.systemInvoiceNumber };
}
