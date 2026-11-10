import { z } from "zod";
import { failure, success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";

/**
 * Nettoyage dans AbaNinja (utilisé par l'essai de connexion). Aucune de ces
 * fonctions n'envoie quoi que ce soit à un client : elles ne font que supprimer.
 */

/** Le corps de la réponse ne nous intéresse pas : un 2xx suffit, même vide (204). */
const anyResponse = z.unknown();

function toVoid(result: Result<unknown, AbaNinjaError>): Result<void, AbaNinjaError> {
  return result.ok ? success(undefined) : failure(result.error);
}

/**
 * Supprime une facture (action « delete » d'AbaNinja, en PATCH). Rejouable sans risque.
 * Un 404 (déjà absente) reste une erreur de code « introuvable » : c'est à l'appelant de décider.
 */
export async function deleteInvoice(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  options: CallOptions = {},
): Promise<Result<void, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: ["accounts", { uuid: config.accountUuid }, "documents", "v2", "invoices", { uuid: invoiceUuid }, "actions", "delete"],
    idempotent: true,
    schema: anyResponse,
  });
  return toVoid(result);
}

/**
 * Supprime un client « société ». AbaNinja répond 409 si le client est encore
 * utilisé (par exemple par une facture) : l'erreur garde alors `status === 409`.
 * Un 404 reste une erreur de code « introuvable » : c'est à l'appelant de décider.
 */
export async function deleteCompany(
  config: AbaNinjaConfig,
  companyUuid: string,
  options: CallOptions = {},
): Promise<Result<void, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "DELETE",
    path: ["accounts", { uuid: config.accountUuid }, "addresses", "v2", "companies", { uuid: companyUuid }],
    idempotent: true,
    schema: anyResponse,
  });
  return toVoid(result);
}
