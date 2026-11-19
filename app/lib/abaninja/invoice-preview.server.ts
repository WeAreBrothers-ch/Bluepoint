import { success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { listDocumentActionNames } from "./document-actions.server";
import { abaNinjaRequest } from "./http.server";
import { buildInvoiceBody } from "./invoice-body";
import { invoiceInputSchema, type AbaNinjaInvoiceInput } from "./invoice-input";
import { validateInput } from "./input-validation";
import type { PathSegment } from "./path";
import { previewResponseSchema } from "./schemas";

/**
 * PDF d'une facture encore en brouillon. L'action `downloadPdf` ne sert qu'aux
 * factures envoyées (AbaNinja répond « Cette fonction est impossible » sur un
 * brouillon) ; pour un brouillon, il faut l'aperçu `POST …/invoices/{uuid}/preview`,
 * qui reçoit le contenu de la facture et renvoie une adresse de téléchargement.
 * Un aperçu ne crée aucun document comptable et n'envoie rien à personne.
 */

function invoiceSegments(config: AbaNinjaConfig, invoiceUuid: string, ...tail: readonly string[]): readonly PathSegment[] {
  return ["accounts", { uuid: config.accountUuid }, "documents", "v2", "invoices", { uuid: invoiceUuid }, ...tail];
}

/** Demande l'aperçu PDF d'un brouillon ; renvoie l'adresse à contrôler avant téléchargement (voir pdf-url). */
export async function requestDraftPreviewUrl(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  input: AbaNinjaInvoiceInput,
  options: CallOptions = {},
): Promise<Result<string, AbaNinjaError>> {
  const valid = validateInput(invoiceInputSchema, input, "Aperçu de la facture");
  if (!valid.ok) return valid;
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "POST",
    path: invoiceSegments(config, invoiceUuid, "preview"),
    body: buildInvoiceBody(valid.value),
    idempotent: false,
    schema: previewResponseSchema,
  });
  return result.ok ? success(result.value) : result;
}

/** Noms des actions qu'AbaNinja autorise sur une facture (diagnostic : jamais de donnée client). */
export async function listInvoiceActionNames(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  options: CallOptions = {},
): Promise<Result<string[], AbaNinjaError>> {
  return listDocumentActionNames(config, invoiceSegments(config, invoiceUuid, "actions"), options);
}
