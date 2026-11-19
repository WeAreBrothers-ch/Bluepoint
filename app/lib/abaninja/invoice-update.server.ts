import { z } from "zod";
import { success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { buildInvoiceBody } from "./invoice-body";
import { invoiceInputSchema, type AbaNinjaInvoiceInput } from "./invoice-input";
import { validateInput } from "./input-validation";

/**
 * Met à jour une facture AbaNinja encore en brouillon (ex. celle née d'un bon de livraison) avec le corps complet :
 * destinataire, compte QR, dates, conditions, lignes. Document entier : rejouable sans risque. N'envoie rien.
 */
export async function updateInvoice(
  config: AbaNinjaConfig,
  invoiceUuid: string,
  input: AbaNinjaInvoiceInput,
  options: CallOptions = {},
): Promise<Result<void, AbaNinjaError>> {
  const valid = validateInput(invoiceInputSchema, input, "Mise à jour de la facture");
  if (!valid.ok) return valid;
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: ["accounts", { uuid: config.accountUuid }, "documents", "v2", "invoices", { uuid: invoiceUuid }],
    body: buildInvoiceBody(valid.value),
    idempotent: true,
    schema: z.unknown(),
  });
  return result.ok ? success(undefined) : result;
}
