import { inspect } from "node:util";
import { failure, success, type Result } from "../core/result";
import { AbaNinjaError } from "./errors";
import { isUuid } from "./uuid";

/**
 * Configuration AbaNinja lue dans l'environnement (ABANINJA_TOKEN et
 * ABANINJA_ACCOUNT_UUID). Le jeton reste enfermé dans l'objet : il n'apparaît
 * ni dans JSON.stringify, ni dans console/inspect, ni dans les messages d'erreur.
 */

const MASKED = "[jeton masqué]";
/** Caractères ASCII imprimables uniquement : ni espace, ni retour à la ligne. */
const TOKEN_PATTERN = /^[\x21-\x7E]{16,2048}$/;

export interface AbaNinjaConfig {
  readonly accountUuid: string;
  /** Valeur de l'en-tête HTTP Authorization. À n'utiliser que pour envoyer la requête. */
  authorizationHeader(): string;
}

class AbaNinjaCredentials implements AbaNinjaConfig {
  readonly #token: string;

  constructor(
    readonly accountUuid: string,
    token: string,
  ) {
    this.#token = token;
  }

  authorizationHeader(): string {
    return `Bearer ${this.#token}`;
  }

  toJSON(): { accountUuid: string; jeton: string } {
    return { accountUuid: this.accountUuid, jeton: MASKED };
  }

  toString(): string {
    return `AbaNinjaConfig(${this.accountUuid}, ${MASKED})`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

function notConfigured(message: string): Result<never, AbaNinjaError> {
  return failure(new AbaNinjaError("non_configure", { message }));
}

/** Lit et valide la configuration ; l'erreur ne contient jamais la valeur du jeton. */
export function readAbaNinjaConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Result<AbaNinjaConfig, AbaNinjaError> {
  // Un espace ou un saut de ligne en bout de valeur est une erreur de copie probable : on le retire avant de valider.
  const token = env["ABANINJA_TOKEN"]?.trim();
  const accountUuid = env["ABANINJA_ACCOUNT_UUID"]?.trim();
  if (token === undefined || token === "") {
    return notConfigured("Le jeton AbaNinja (ABANINJA_TOKEN) est absent.");
  }
  if (!TOKEN_PATTERN.test(token)) {
    return notConfigured(
      "Le jeton AbaNinja (ABANINJA_TOKEN) contient des caractères invalides (espace ou saut de ligne au milieu, accent) ou sa longueur est anormale.",
    );
  }
  if (accountUuid === undefined || accountUuid === "") {
    return notConfigured("L'identifiant de compte AbaNinja (ABANINJA_ACCOUNT_UUID) est absent.");
  }
  if (!isUuid(accountUuid)) {
    return notConfigured(
      "L'identifiant de compte AbaNinja (ABANINJA_ACCOUNT_UUID) est invalide : il doit ressembler à 123e4567-e89b-42d3-a456-426614174000.",
    );
  }
  return success(new AbaNinjaCredentials(accountUuid, token));
}
