import { logError } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { markUncertain, resolveUncertain } from "./repository.server";
import { findLatestTrial } from "./trial-repository.server";
import { resolveAvailability } from "./trial-policy";

/**
 * Débloquer un essai resté « incertain » ou « en cours » : la personne a vérifié dans AbaNinja que la
 * facture d'essai n'existe pas. Le serveur refuse tant que 30 minutes ne se sont pas écoulées
 * depuis la dernière mise à jour, et ne touche jamais à un essai terminé.
 */

export class TrialResolveError extends Error {
  override readonly name = "TrialResolveError";
}

const DATABASE_PROBLEM = "La base de l’application n’a pas répondu. Réessayez dans quelques instants.";

export const RESOLVED_MESSAGE =
  "C’est noté : la facture d’essai n’existe pas. Un nouvel essai est possible. Si un client « Client essai BluePoint (à supprimer) » existe dans AbaNinja, supprimez-le d’abord.";

export async function resolveStuckTrial(shop: string, reference: string, now: Date): Promise<Result<void, TrialResolveError>> {
  const latest = await findLatestTrial(shop);
  if (!latest.ok) {
    logError("Déblocage de l’essai AbaNinja : essai illisible", latest.error, { shop });
    return failure(new TrialResolveError(DATABASE_PROBLEM));
  }
  const trial = latest.value;
  if (trial === null || trial.reference !== reference) {
    return failure(new TrialResolveError("Ce n’est plus le dernier essai. Rechargez la page."));
  }
  const availability = resolveAvailability(trial, now);
  if (availability.kind === "non") return failure(new TrialResolveError("Cet essai n’a rien à débloquer."));
  if (availability.kind === "attente") {
    return failure(new TrialResolveError(`Trop tôt : patientez encore environ ${availability.minutes} minutes avant de débloquer.`));
  }
  // Un essai « en cours » est d'abord déclaré incertain : seul un essai incertain peut être tranché.
  const frozen = trial.state === "en_cours" ? await markUncertain(trial.orderId, "abandonnee") : success(trial);
  const resolved = frozen.ok ? await resolveUncertain(trial.orderId, "absente") : frozen;
  if (resolved.ok) return success(undefined);
  logError("Déblocage de l’essai AbaNinja : changement refusé", resolved.error, { shop });
  return failure(new TrialResolveError("Le déblocage n’a pas pu être noté : l’essai a peut-être changé. Rechargez la page."));
}
