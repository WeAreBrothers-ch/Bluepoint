/** Options communes aux appels de haut niveau ; les valeurs par défaut conviennent en production, les tests injectent un faux fetch. */
export interface CallOptions {
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Délai maximal d'UNE tentative (15 s par défaut). */
  readonly timeoutMs?: number;
  /**
   * Échéance globale : quand ce signal est déclenché (ex. `AbortSignal.timeout(50_000)`),
   * l'appel en cours est interrompu, plus aucun réessai ni pause n'a lieu, et l'appel
   * renvoie une erreur de code « indisponible » sans réessayer.
   */
  readonly signal?: AbortSignal;
}
