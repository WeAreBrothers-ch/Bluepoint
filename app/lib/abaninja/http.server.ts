import type { z } from "zod";
import { logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { discardBody, readBodyLimited } from "./body-limit.server";
import { buildCallSignal, isGloballyAborted } from "./deadline";
import { logErrorBody, MAX_ERROR_BODY_BYTES } from "./error-body-log.server";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError, errorFromStatus } from "./errors";
import { ABANINJA_BASE_URL, buildRequestPath, maskPath, type PathSegment, type QueryParams } from "./path";
import {
  isRetryableMethod,
  MAX_RETRIES,
  parseRetryAfterMs,
  retryDelayMs,
  sleep,
  type HttpMethod,
} from "./retry";

/**
 * Client HTTP AbaNinja. Sécurité : hôte fixe (aucune URL fournie de l'extérieur),
 * redirections jamais suivies (le jeton ne part jamais ailleurs), délai maximal,
 * taille de réponse bornée, jamais de réessai d'un POST. Une échéance globale
 * (`signal`) arrête aussi les réessais et les pauses.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

export interface RequestOptions {
  readonly config: AbaNinjaConfig;
  readonly method: HttpMethod;
  readonly path: readonly PathSegment[];
  readonly query?: QueryParams;
  readonly body?: unknown;
  /** Pour PUT/PATCH/DELETE : l'appelant certifie qu'on peut répéter l'opération sans risque. */
  readonly idempotent?: boolean;
  /** Délai maximal d'UNE tentative. */
  readonly timeoutMs?: number;
  /** Échéance globale de l'appelant : une fois déclenchée, plus aucune tentative ni pause (erreur « indisponible »). */
  readonly signal?: AbortSignal;
  readonly maxBytes?: number;
  /** Injectables pour les tests. */
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface JsonRequestOptions<TData> extends RequestOptions {
  readonly schema: z.ZodType<TData>;
}

interface Attempt {
  readonly result: Result<Response, AbaNinjaError>;
  readonly retryAfterMs: number | undefined;
}

function isTimeout(thrown: unknown): boolean {
  return thrown instanceof Error && (thrown.name === "TimeoutError" || thrown.name === "AbortError");
}

function buildInit(options: RequestOptions, accept: string): RequestInit {
  const hasBody = options.body !== undefined;
  return {
    method: options.method,
    redirect: "manual",
    signal: buildCallSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal),
    headers: {
      Authorization: options.config.authorizationHeader(),
      Accept: accept,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
  };
}

function logAttempt(method: HttpMethod, path: string, status: number | string, startedAt: number): void {
  logInfo("AbaNinja", { method, path: maskPath(path), statut: status, dureeMs: Date.now() - startedAt });
}

/** Lit (16 Ko max) puis journalise le résumé sûr du corps d'erreur ; le corps n'est jamais renvoyé à l'appelant. */
async function logAndDiscardErrorBody(response: Response, path: string): Promise<void> {
  const body = await readBodyLimited(response, MAX_ERROR_BODY_BYTES);
  if (body.ok) logErrorBody(response.status, maskPath(path), body.value);
  else await discardBody(response);
}

function abortedError(thrown: unknown, options: RequestOptions): AbaNinjaError {
  if (isGloballyAborted(options.signal)) {
    return new AbaNinjaError("indisponible", {
      cause: thrown,
      message: "L'opération a dépassé le temps total prévu et a été interrompue.",
    });
  }
  const message = isTimeout(thrown) ? "AbaNinja n'a pas répondu à temps, réessayez dans quelques instants." : undefined;
  return new AbaNinjaError("indisponible", { cause: thrown, ...(message ? { message } : {}) });
}

async function attemptOnce(options: RequestOptions, path: string, accept: string): Promise<Attempt> {
  const startedAt = Date.now();
  try {
    const doFetch = options.fetchImpl ?? fetch;
    const response = await doFetch(`${ABANINJA_BASE_URL}${path}`, buildInit(options, accept));
    logAttempt(options.method, path, response.status, startedAt);
    if (response.ok) return { result: success(response), retryAfterMs: undefined };
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"), Date.now());
    await logAndDiscardErrorBody(response, path);
    return { result: failure(errorFromStatus(response.status)), retryAfterMs };
  } catch (thrown) {
    const timedOut = isTimeout(thrown);
    logAttempt(options.method, path, timedOut ? "delai_depasse" : "reseau", startedAt);
    return { result: failure(abortedError(thrown, options)), retryAfterMs: undefined };
  }
}

async function send(options: RequestOptions, accept: string): Promise<Result<Response, AbaNinjaError>> {
  const built = buildRequestPath(options.path, options.query);
  if (!built.ok) return built;
  const mayRetry = isRetryableMethod(options.method, options.idempotent === true);
  const pause = options.sleep ?? ((ms: number): Promise<void> => sleep(ms, options.signal));
  for (let attempt = 0; ; attempt += 1) {
    if (isGloballyAborted(options.signal)) return failure(abortedError(options.signal?.reason, options));
    const { result, retryAfterMs } = await attemptOnce(options, built.value, accept);
    const giveUp = !mayRetry || attempt >= MAX_RETRIES || isGloballyAborted(options.signal);
    if (result.ok || giveUp || !result.error.retryable) return result;
    await pause(retryDelayMs(attempt, retryAfterMs, Math.random));
  }
}

function invalidResponse(): AbaNinjaError {
  return new AbaNinjaError("reponse_invalide");
}

function parseJson<TData>(bytes: Uint8Array, schema: z.ZodType<TData>): Result<TData, AbaNinjaError> {
  let json: unknown;
  try {
    const text = new TextDecoder().decode(bytes);
    json = text === "" ? undefined : JSON.parse(text);
  } catch {
    logInfo("AbaNinja : réponse qui n'est pas du JSON");
    return failure(invalidResponse());
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return success(parsed.data);
  const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(",");
  logInfo("AbaNinja : réponse non conforme au schéma", { champs: fields });
  return failure(invalidResponse());
}

/** Appelle l'API et renvoie la réponse JSON validée par `schema`. */
export async function abaNinjaRequest<TData>(options: JsonRequestOptions<TData>): Promise<Result<TData, AbaNinjaError>> {
  const sent = await send(options, "application/json");
  if (!sent.ok) return sent;
  const body = await readBodyLimited(sent.value, options.maxBytes ?? MAX_JSON_BYTES);
  if (!body.ok) return body;
  return parseJson(body.value, options.schema);
}
