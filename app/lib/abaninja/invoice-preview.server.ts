import { failure, success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { buildInvoiceBody } from "./invoice-body";
import { invoiceInputSchema, type AbaNinjaInvoiceInput } from "./invoice-input";
import { validateInput } from "./input-validation";
import { invoiceActionsResponseSchema, previewResponseSchema } from "./schemas";

/**
 * PDF d'une facture encore en brouillon. L'action `downloadPdf` ne sert qu'aux
 * factures envoyées (AbaNinja répond « Cette fonction est impossible » sur un
 * brouillon) ; pour un brouillon, il faut l'aperçu `POST …/invoices/{uuid}/preview`,
 * qui reçoit le contenu de la facture et renvoie une adresse de téléchargement.
 * Un aperçu ne crée aucun document comptable et n'envoie rien à personne.
 */

function invoiceSegments(config: AbaNinjaConfig, invoiceUuid: string, ...tail: readonly string[]) {
  return ["accounts", { uuid: config.accountUuid }, "documents", "v2", "invoices", { uuid: invoiceUuid }, ...tail] as const;
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

const MAX_ACTION_NAMES = 40;
const ACTION_NAME_PATTERN = /[^A-Za-z0-9_]/g;

function actionNameOf(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (typeof entry !== "object" || entry === null) return undefined;
  const record = entry as Readonly<Record<string, unknown>>;
  const name = record["name"] ?? record["action"];
  return typeof name === "string" ? name : undefined;
}

function cleanNames(names: readonly (string | undefined)[]): string[] {
  return names
    .filter((name): name is string => name !== undefined && name !== "")
    .slice(0, MAX_ACTION_NAMES)
    .map((name) => name.replace(ACTION_NAME_PATTERN, "?").slice(0, 40));
}

/** Noms des actions qu'AbaNinja autorise sur une facture (diagnostic : jamais de donnée client). */
export async function listInvoiceActionNames(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  options: CallOptions = {},
): Promise<Result<string[], AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "GET",
    path: invoiceSegments(config, invoiceUuid, "actions"),
    schema: invoiceActionsResponseSchema,
  });
  if (!result.ok) return result;
  const data = result.value.data;
  if (Array.isArray(data)) return success(cleanNames(data.map(actionNameOf)));
  if (typeof data === "object" && data !== null) return success(cleanNames(Object.keys(data)));
  return failure(new AbaNinjaError("reponse_invalide"));
}
