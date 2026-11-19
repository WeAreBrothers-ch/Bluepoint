import { failure, success, type Result } from "../core/result";
import { parseIsoDate, type IsoDate } from "../metafields/definitions";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { buildInvoiceBody } from "./invoice-body";
import { classifyCreateFailure, CreateInvoiceError } from "./invoice-errors";
import { todayInZurich } from "./invoice-status";
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
  /** Date de la facture (AAAA-MM-JJ) ; null si AbaNinja ne la renvoie pas ou sous une forme inconnue. */
  readonly invoiceDate: IsoDate | null;
  readonly systemInvoiceNumber: string | null;
  /** Référence choisie à la création (ex. « BP-1042 ») ; null si AbaNinja n'en renvoie pas. */
  readonly reference: string | null;
  readonly isCancelled: boolean | undefined;
  /** Société destinataire (null pour une personne, ou si AbaNinja ne la renvoie pas). */
  readonly companyUuid: string | null;
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
const WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** Le jour d'une date AbaNinja : telle quelle, ou le jour à Zurich d'un instant donné avec son fuseau ; null sinon. */
function dayOf(value: string | null | undefined): IsoDate | null {
  if (typeof value !== "string") return null;
  if (WITH_ZONE.test(value)) {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? null : parseIsoDate(todayInZurich(at));
  }
  return parseIsoDate(LOCAL_TIME.test(value) ? value.slice(0, 10) : value);
}

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
    invoiceDate: dayOf(record.invoiceDate),
    systemInvoiceNumber: record.systemInvoiceNumber ?? null,
    reference: record.reference ?? null,
    isCancelled: record.isCancelled,
    companyUuid: record.receiver?.companyUuid ?? null,
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
