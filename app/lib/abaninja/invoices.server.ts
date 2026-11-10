import { failure, success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { buildInvoiceBody } from "./invoice-body";
import { classifyCreateFailure, CreateInvoiceError } from "./invoice-errors";
import { invoiceInputSchema, type AbaNinjaInvoiceInput } from "./invoice-input";
import { validateInput } from "./input-validation";
import { createInvoiceResponseSchema, downloadPdfResponseSchema, readInvoiceResponseSchema } from "./schemas";

export { CreateInvoiceError } from "./invoice-errors";

export interface CreatedInvoice {
  readonly uuid: string;
  readonly systemInvoiceNumber: string | null;
}

export interface InvoiceDetails {
  readonly uuid: string;
  readonly status: string;
  readonly sentStatus: string | null;
  readonly openAmount: number | null;
  readonly dueDate: string | null;
  readonly systemInvoiceNumber: string | null;
  readonly isCancelled: boolean | undefined;
}

function toSegments(config: AbaNinjaConfig, ...tail: readonly (string | { readonly uuid: string })[]) {
  return ["accounts", { uuid: config.accountUuid }, "documents", "v2", "invoices", ...tail] as const;
}

function uncertain(message: string): CreateInvoiceError {
  return new CreateInvoiceError(new AbaNinjaError("reponse_invalide", { message }), "incertaine");
}

/**
 * Crée UNE facture. Jamais de réessai automatique (le client HTTP n'en fait
 * pas pour un POST). En cas d'échec, `error.outcome` indique si la facture
 * peut exister malgré tout.
 */
export async function createInvoice(
  config: AbaNinjaConfig,
  input: AbaNinjaInvoiceInput,
  options: CallOptions = {},
): Promise<Result<CreatedInvoice, CreateInvoiceError>> {
  const valid = validateInput(invoiceInputSchema, input, "Création de la facture");
  if (!valid.ok) return failure(new CreateInvoiceError(valid.error, "refusee"));
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "POST",
    path: toSegments(config),
    body: buildInvoiceBody(valid.value),
    idempotent: false,
    schema: createInvoiceResponseSchema,
  });
  if (!result.ok) return failure(new CreateInvoiceError(result.error, classifyCreateFailure(result.error)));
  if (result.value.kind === "queued") {
    const queued = new AbaNinjaError("reponse_invalide", { status: 202 });
    return failure(new CreateInvoiceError(queued, "incertaine", result.value.queueUuid));
  }
  const [created, ...others] = result.value.documents;
  if (others.length > 0) return failure(uncertain("AbaNinja a renvoyé plusieurs factures pour une seule demande."));
  return success({ uuid: created.uuid, systemInvoiceNumber: created.systemInvoiceNumber ?? null });
}

/** Lit l'état d'une facture ; refuse une réponse qui concerne une autre facture. */
export async function getInvoice(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  options: CallOptions = {},
): Promise<Result<InvoiceDetails, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "GET",
    path: toSegments(config, { uuid: invoiceUuid }),
    schema: readInvoiceResponseSchema,
  });
  if (!result.ok) return result;
  const record = result.value;
  if (record.uuid.toLowerCase() !== invoiceUuid.toLowerCase()) return failure(new AbaNinjaError("reponse_invalide"));
  return success({
    uuid: record.uuid,
    status: record.status,
    sentStatus: record.sentStatus ?? null,
    openAmount: record.openAmount ?? null,
    dueDate: record.dueDate ?? null,
    systemInvoiceNumber: record.systemInvoiceNumber ?? null,
    isCancelled: record.isCancelled,
  });
}

/** Première étape du PDF : demande l'adresse de téléchargement (à valider avant usage, voir pdf-download). */
export async function requestInvoicePdfUrl(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  options: CallOptions = {},
): Promise<Result<string, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: toSegments(config, { uuid: invoiceUuid }, "actions", "downloadPdf"),
    idempotent: true,
    schema: downloadPdfResponseSchema,
  });
  return result.ok ? success(result.value.data.downloadUrl) : result;
}
