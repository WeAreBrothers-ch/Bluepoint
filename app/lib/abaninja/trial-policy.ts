import type { AbaNinjaInvoice } from "./repository-types";

/** Règles de temps de l'essai : un seul endroit, partagé par le garde-fou, la page et l'action. */

/** Un essai par minute. */
export const MIN_DELAY_MS = 60_000;
/** Un essai « en cours » ou « incertain » bloque les suivants pendant 6 h : il faut d'abord regarder dans AbaNinja. */
export const UNRESOLVED_WINDOW_MS = 6 * 60 * 60 * 1000;
/** Délai minimum avant de pouvoir dire « la facture d'essai n'existe pas » (mesuré sur la dernière mise à jour). */
export const RESOLVE_AFTER_MS = 30 * 60 * 1000;
/** Temps total accordé à un essai (la fonction serveur doit pouvoir le tenir). */
export const TRIAL_DEADLINE_MS = 50_000;

export function isUnresolved(trial: Pick<AbaNinjaInvoice, "state">): boolean {
  return trial.state === "en_cours" || trial.state === "incertaine";
}

/** Peut-on débloquer le dernier essai ? Jamais pour une ligne « creee » ou « refusee ». */
export type ResolveAvailability =
  | { readonly kind: "non" }
  | { readonly kind: "attente"; readonly minutes: number }
  | { readonly kind: "possible" };

export function resolveAvailability(
  trial: Pick<AbaNinjaInvoice, "state" | "updatedAt"> | null,
  now: Date,
): ResolveAvailability {
  if (trial === null || !isUnresolved(trial)) return { kind: "non" };
  const idleMs = now.getTime() - trial.updatedAt.getTime();
  if (idleMs >= RESOLVE_AFTER_MS) return { kind: "possible" };
  return { kind: "attente", minutes: Math.max(1, Math.ceil((RESOLVE_AFTER_MS - idleMs) / 60_000)) };
}
