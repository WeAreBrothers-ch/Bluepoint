import { failure, success, type Result } from "../core/result";
import type { CreatedDocuments } from "./trial-create.server";
import { TRIAL_DEADLINE_MS } from "./trial-policy";
import { TrialError, TRIAL_STEP_KEYS, type TrialContext, type TrialLog, type TrialReport } from "./trial-types";

/** Fin de l'essai : le titre, les notes et le rapport final. */

const QR_NOTE = "Le bulletin QR du PDF ne peut pas être vérifié automatiquement.";
const RERUN_HINT = "Pour le voir, relancez un essai en cochant « Garder la facture d’essai », puis ouvrez-la dans AbaNinja.";
const KEPT_NOTE = "Ouvrez la facture dans AbaNinja pour regarder le PDF et son bulletin QR, puis supprimez-la.";
const NUMBER_NOTE = "Même pour un essai, AbaNinja peut avoir déjà utilisé un numéro de facture : si vous voyez un trou dans votre numérotation, c’est lui.";

export function firstFailureHeadline(log: TrialLog): string {
  const step = log.report({ ok: false, headline: "" }).steps.find((candidate) => candidate.outcome === "echec");
  return step === undefined ? "L’essai s’est arrêté." : `L’essai s’est arrêté à l’étape « ${step.label} ».`;
}

function headlineOf(log: TrialLog, ok: boolean, dirty: boolean, timedOut: boolean): string {
  if (timedOut && !ok) return `Le temps prévu pour l’essai (${TRIAL_DEADLINE_MS / 1000} secondes) est écoulé : l’essai a été interrompu.`;
  if (!ok) return firstFailureHeadline(log);
  return `La connexion à AbaNinja fonctionne.${dirty ? " Mais l’essai n’a pas pu être entièrement effacé." : ""}`;
}

function notesOf(ok: boolean, keep: boolean, created: CreatedDocuments): string[] {
  const notes = ok ? [keep ? KEPT_NOTE : `${QR_NOTE} ${RERUN_HINT}`] : [];
  return created.invoiceUuid !== null || created.uncertain ? [...notes, NUMBER_NOTE] : notes;
}

export function finishTrial(
  ctx: TrialContext,
  log: TrialLog,
  created: CreatedDocuments,
  keep: boolean,
  manual: readonly string[],
): Result<TrialReport, TrialError> {
  const ok = TRIAL_STEP_KEYS.filter((key) => key !== "nettoyage").every((key) => log.outcomeOf(key) === "ok");
  const dirty = manual.length > 0 && !keep;
  const report = log.report({
    ok,
    headline: headlineOf(log, ok, dirty, ctx.call.signal?.aborted === true),
    reference: ctx.reference,
    invoiceNumber: created.invoiceNumber === "" ? null : created.invoiceNumber,
    manualCleanup: manual,
    notes: notesOf(ok, keep, created),
  });
  return ok ? success(report) : failure(new TrialError(report));
}
