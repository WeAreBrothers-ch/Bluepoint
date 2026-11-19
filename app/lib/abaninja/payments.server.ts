import { z } from "zod";
import { success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { validateInput } from "./input-validation";
import { buildPaymentBody, paymentInputSchema, type PaymentInput } from "./payment-input";

export type { PaymentInput, PaymentType } from "./payment-input";

/** Inscrit UN paiement reçu sur une facture. Jamais de réessai : un POST rejoué compterait le paiement deux fois. */
export async function recordPayment(config: AbaNinjaConfig, input: PaymentInput, options: CallOptions = {}): Promise<Result<void, AbaNinjaError>> {
  const valid = validateInput(paymentInputSchema, input, "Inscription du paiement");
  if (!valid.ok) return valid;
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "POST",
    path: ["accounts", { uuid: config.accountUuid }, "finances", "v2", "payments"],
    body: buildPaymentBody(valid.value),
    idempotent: false,
    schema: z.unknown(),
  });
  return result.ok ? success(undefined) : result;
}
