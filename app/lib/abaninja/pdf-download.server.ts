import { logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { discardBody, readBodyLimited } from "./body-limit.server";
import type { CallOptions } from "./call-options";
import { buildCallSignal } from "./deadline";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError, errorFromStatus } from "./errors";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import { requestDraftPreviewUrl } from "./invoice-preview.server";
import { requestInvoicePdfUrl } from "./invoices.server";
import { checkDownloadUrl, type CheckedDownloadUrl } from "./pdf-url";

/**
 * Téléchargement du PDF en deux temps : (1) AbaNinja donne une adresse,
 * (2) on la télécharge si elle passe tous les contrôles (voir pdf-url.ts).
 * fetch est appelé directement ici car l'adresse est absolue et le jeton ne
 * doit pas toujours être envoyé.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function invalidPdf(message?: string): AbaNinjaError {
  return new AbaNinjaError("reponse_invalide", message === undefined ? {} : { message });
}

function buildHeaders(target: CheckedDownloadUrl, config: AbaNinjaConfig): Record<string, string> {
  return {
    Accept: "application/pdf",
    ...(target.sendAuthorization ? { Authorization: config.authorizationHeader() } : {}),
  };
}

async function fetchPdfResponse(
  target: CheckedDownloadUrl,
  config: AbaNinjaConfig,
  options: CallOptions,
): Promise<Result<Response, AbaNinjaError>> {
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch(target.url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: buildCallSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal),
      headers: buildHeaders(target, config),
    });
    logInfo("AbaNinja : téléchargement du PDF", { hote: target.url.hostname, statut: response.status });
    if (response.ok) return success(response);
    await discardBody(response);
    return failure(errorFromStatus(response.status));
  } catch (thrown) {
    logInfo("AbaNinja : téléchargement du PDF impossible", { hote: target.url.hostname });
    return failure(new AbaNinjaError("indisponible", { cause: thrown }));
  }
}

async function readPdf(response: Response): Promise<Result<Uint8Array, AbaNinjaError>> {
  const body = await readBodyLimited(response, MAX_PDF_BYTES);
  if (!body.ok) return body;
  if (!PDF_MAGIC.every((byte, index) => body.value[index] === byte)) {
    return failure(invalidPdf("Le fichier reçu d'AbaNinja n'est pas un PDF valide."));
  }
  return success(body.value);
}

async function downloadFrom(
  requested: Result<string, AbaNinjaError>,
  config: AbaNinjaConfig,
  options: CallOptions,
): Promise<Result<Uint8Array, AbaNinjaError>> {
  if (!requested.ok) return requested;
  const target = checkDownloadUrl(requested.value);
  if (!target.ok) {
    logInfo("AbaNinja : adresse de PDF refusée", { raison: target.error.message });
    return target;
  }
  const response = await fetchPdfResponse(target.value, config, options);
  return response.ok ? readPdf(response.value) : response;
}

/** PDF d'une facture envoyée (10 Mo max, début « %PDF- » vérifié). Refusé par AbaNinja sur un brouillon. */
export async function downloadInvoicePdf(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  options: CallOptions = {},
): Promise<Result<Uint8Array, AbaNinjaError>> {
  return downloadFrom(await requestInvoicePdfUrl(config, invoiceUuid, options), config, options);
}

/** PDF d'une facture en brouillon, via l'aperçu (mêmes contrôles que ci-dessus). */
export async function downloadDraftInvoicePdf(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  input: AbaNinjaInvoiceInput,
  options: CallOptions = {},
): Promise<Result<Uint8Array, AbaNinjaError>> {
  return downloadFrom(await requestDraftPreviewUrl(config, invoiceUuid, input, options), config, options);
}
