/**
 * Résultat explicite d'une opération qui peut échouer : on renvoie l'erreur
 * au lieu de la lancer, pour que l'appelant soit obligé de la traiter.
 */
export type Result<TValue, TError extends Error = Error> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export function success<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function failure<TError extends Error>(error: TError): Result<never, TError> {
  return { ok: false, error };
}

/** Transforme n'importe quelle valeur lancée (throw) en véritable Error. */
export function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  return new Error(typeof thrown === "string" ? thrown : "Erreur inconnue");
}
