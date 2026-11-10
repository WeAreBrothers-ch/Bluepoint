import { logError } from "../core/logger.server";
import { recordCleanupIssue } from "./repository.server";
import type { CleanupIssueCode } from "./repository-types";
import { cleanUpTrial } from "./trial-cleanup.server";
import type { CreatedDocuments } from "./trial-create.server";
import { manualStepsFor, uncertainSteps } from "./trial-manual-steps";
import type { TrialContext, TrialLog } from "./trial-types";

/** Étape 7 vue de l'essai : décide si on nettoie, note le résultat dans le carnet, et mémorise ce qui reste à faire. */

async function rememberIssue(ctx: TrialContext, code: CleanupIssueCode): Promise<void> {
  const saved = await recordCleanupIssue(ctx.orderId, code);
  if (!saved.ok) logError("Essai AbaNinja : nettoyage incomplet non noté", saved.error, { shop: ctx.shop });
}

async function skipAndRemember(ctx: TrialContext, log: TrialLog, message: string, code: CleanupIssueCode, created: CreatedDocuments) {
  log.skip("nettoyage", message);
  await rememberIssue(ctx, code);
  return manualStepsFor(ctx.reference, { invoice: created.invoiceUuid !== null, company: created.companyUuid !== null });
}

/** Renvoie ce que le propriétaire doit supprimer lui-même (vide si tout est effacé). */
export async function runCleanup(
  ctx: TrialContext,
  log: TrialLog,
  created: CreatedDocuments,
  keep: boolean,
): Promise<readonly string[]> {
  if (created.uncertain) {
    log.skip("nettoyage", "Rien n’a été supprimé : on ne sait pas si le client ou la facture existe.");
    return uncertainSteps(ctx.reference, created);
  }
  const hasInvoice = created.invoiceUuid !== null;
  if (!hasInvoice && created.companyUuid === null) return [];
  if (keep && hasInvoice) {
    return skipAndRemember(ctx, log, "Gardé à votre demande, pour que vous puissiez regarder la facture dans AbaNinja.", "gardee", created);
  }
  if (ctx.call.signal?.aborted === true) {
    return skipAndRemember(ctx, log, "Le temps prévu pour l’essai est écoulé : rien n’a été supprimé.", "nettoyage_incomplet", created);
  }
  const outcome = await cleanUpTrial(ctx, created);
  if (outcome.result === "ok") log.ok("nettoyage", outcome.message);
  else if (outcome.result === "saute") log.skip("nettoyage", outcome.message);
  else log.fail("nettoyage", outcome.message);
  if (outcome.issue !== null) await rememberIssue(ctx, outcome.issue);
  return outcome.manualSteps;
}
