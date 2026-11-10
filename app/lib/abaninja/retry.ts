/** Règles de réessai : bornées, avec attente exponentielle et gigue. */

export const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;
export const MAX_DELAY_MS = 10_000;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Un GET se réessaie toujours ; PUT/PATCH/DELETE seulement si l'appelant a
 * déclaré l'opération sûre à répéter ; un POST de création jamais
 * (risque de facture en double).
 */
export function isRetryableMethod(method: HttpMethod, markedIdempotent: boolean): boolean {
  if (method === "GET") return true;
  if (method === "POST") return false;
  return markedIdempotent;
}

/** Lit l'en-tête Retry-After (secondes ou date HTTP) et le convertit en millisecondes. */
export function parseRetryAfterMs(value: string | null, nowMs: number): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - nowMs);
}

/** Attente avant le prochain essai (`attempt` commence à 0), plafonnée à MAX_DELAY_MS. */
export function retryDelayMs(attempt: number, retryAfterMs: number | undefined, random: () => number): number {
  const exponential = BASE_DELAY_MS * 2 ** attempt;
  const jitter = random() * BASE_DELAY_MS;
  return Math.min(MAX_DELAY_MS, retryAfterMs ?? exponential + jitter);
}

/** Pause qui se termine plus tôt si `signal` est déclenché (l'appelant vérifie alors `signal.aborted`). */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted === true) return resolve();
    const finish = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });
}
