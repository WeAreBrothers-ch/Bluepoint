import { failure, success, type Result } from "../core/result";
import type { AbaNinjaInvoice } from "./repository-types";
import { findLatestTrial } from "./trial-repository.server";
import { isUnresolved, MIN_DELAY_MS, UNRESOLVED_WINDOW_MS } from "./trial-policy";
import { TrialBlockedError } from "./trial-types";

/** Qui a le droit de lancer un essai : un par minute, et pas tant qu'un essai précédent est resté en suspens. */

const UNRESOLVED_TEXT =
  "Aucun nouvel essai n’est possible pour l’instant, par prudence. Regardez dans AbaNinja si une facture ou un client « essai » existe et supprimez-les. Sur cette page, un bouton pour débloquer apparaît 30 minutes après le dernier essai ; sans cela, un nouvel essai sera possible 6 heures après lui.";

/** Décision pure : renvoie la raison du blocage, ou null si l'essai peut partir. */
export function blockReason(latest: AbaNinjaInvoice | null, now: Date): string | null {
  if (latest === null) return null;
  const age = now.getTime() - latest.createdAt.getTime();
  if (isUnresolved(latest) && age < UNRESOLVED_WINDOW_MS) {
    return `Le dernier essai (référence ${latest.reference}) n’est pas terminé ou son résultat est incertain. ${UNRESOLVED_TEXT}`;
  }
  if (age < MIN_DELAY_MS) return "Un essai vient d’être fait. Attendez une minute avant d’en lancer un autre.";
  return null;
}

/** Échec = base illisible (Error) ou essai refusé (TrialBlockedError). */
export async function ensureTrialAllowed(shop: string, now: Date): Promise<Result<void, Error>> {
  const latest = await findLatestTrial(shop);
  if (!latest.ok) return failure(latest.error);
  const reason = blockReason(latest.value, now);
  return reason === null ? success(undefined) : failure(new TrialBlockedError(reason));
}
