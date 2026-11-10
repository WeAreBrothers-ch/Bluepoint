/**
 * Délais d'un appel AbaNinja : chaque appel a son propre délai maximal, et
 * l'appelant peut fournir en plus une échéance GLOBALE (`CallOptions.signal`,
 * par exemple le délai total d'un essai de connexion). Dès que l'un des deux
 * expire, la requête en cours, les réessais et les pauses s'arrêtent.
 */

/** Signal qui se déclenche quand le délai de l'appel OU l'échéance globale expire. */
export function buildCallSignal(timeoutMs: number, globalSignal: AbortSignal | undefined): AbortSignal {
  const perCall = AbortSignal.timeout(timeoutMs);
  return globalSignal === undefined ? perCall : AbortSignal.any([perCall, globalSignal]);
}

/** Vrai si l'échéance globale est déjà dépassée : inutile de lancer ou de réessayer un appel. */
export function isGloballyAborted(globalSignal: AbortSignal | undefined): boolean {
  return globalSignal?.aborted === true;
}
