import { logError } from "../core/logger.server";
import { parseTrialForm } from "./trial-form";
import { RESOLVED_MESSAGE, resolveStuckTrial } from "./trial-resolve.server";
import { runConnectionTrial } from "./trial.server";
import { TrialBlockedError, type TrialActionResult } from "./trial-types";
import { frenchTypography } from "./trial-typography";

/** Ce que fait la page quand on envoie un formulaire : lancer l'essai, ou débloquer un essai incertain. */

export interface TrialActionOutcome {
  readonly result: TrialActionResult;
  readonly status: number;
}

const NOT_UNDERSTOOD = "La demande n’a pas été comprise (confirmation manquante). Rechargez la page et réessayez.";
const UNEXPECTED =
  "L’essai n’a pas pu aller au bout à cause d’un problème inattendu. Vérifiez dans AbaNinja qu’aucune facture « essai » n’a été laissée, puis réessayez plus tard.";

function text(kind: "erreur" | "debloque", message: string): TrialActionResult {
  return { kind, message: frenchTypography(message) };
}

async function startTrial(shop: string, keepInvoice: boolean): Promise<TrialActionOutcome> {
  const result = await runConnectionTrial(shop, { keepInvoice });
  if (result.ok) return { result: { kind: "rapport", report: result.value }, status: 200 };
  if (result.error instanceof TrialBlockedError) return { result: { kind: "bloque", message: result.error.message }, status: 200 };
  return { result: { kind: "rapport", report: result.error.report }, status: 200 };
}

async function unblock(shop: string, reference: string, now: Date): Promise<TrialActionOutcome> {
  const resolved = await resolveStuckTrial(shop, reference, now);
  if (resolved.ok) return { result: text("debloque", RESOLVED_MESSAGE), status: 200 };
  return { result: text("erreur", resolved.error.message), status: 409 };
}

export async function runTrialAction(shop: string, formData: FormData, now: Date = new Date()): Promise<TrialActionOutcome> {
  const form = parseTrialForm(formData);
  if (form.kind === "refuse") return { result: text("erreur", NOT_UNDERSTOOD), status: 400 };
  try {
    return form.kind === "essai" ? await startTrial(shop, form.keepInvoice) : await unblock(shop, form.reference, now);
  } catch (error) {
    logError("Essai AbaNinja : erreur inattendue", error, { shop });
    return { result: text("erreur", UNEXPECTED), status: 500 };
  }
}
