/**
 * Erreurs typées de l'API AbaNinja.
 * Les messages sont fixes et lisibles par un non-technicien : on n'y met
 * JAMAIS le corps brut d'une réponse (il peut contenir des données client)
 * ni le jeton d'accès.
 */

export type AbaNinjaErrorCode =
  | "non_configure"
  | "non_autorise"
  | "introuvable"
  | "donnees_refusees"
  | "trop_de_requetes"
  | "indisponible"
  | "reponse_invalide";

const MESSAGES: Readonly<Record<AbaNinjaErrorCode, string>> = {
  non_configure: "AbaNinja n'est pas encore configuré : le jeton ou l'identifiant du compte est manquant.",
  non_autorise: "AbaNinja a refusé l'accès : le jeton est invalide, expiré ou n'a pas les droits nécessaires.",
  introuvable: "AbaNinja ne trouve pas cet élément (facture, client ou document).",
  donnees_refusees: "AbaNinja a refusé les informations envoyées : vérifiez les données de la facture.",
  trop_de_requetes: "AbaNinja reçoit trop de demandes pour le moment, réessayez dans quelques instants.",
  indisponible: "AbaNinja est momentanément injoignable, réessayez dans quelques instants.",
  reponse_invalide: "AbaNinja a répondu dans un format inattendu.",
};

const RETRYABLE_CODES: ReadonlySet<AbaNinjaErrorCode> = new Set(["trop_de_requetes", "indisponible"]);

export interface AbaNinjaErrorOptions {
  readonly status?: number;
  readonly cause?: unknown;
  /** Message français écrit par notre code (jamais issu d'une réponse AbaNinja). */
  readonly message?: string;
}

export class AbaNinjaError extends Error {
  override readonly name = "AbaNinjaError";
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(
    readonly code: AbaNinjaErrorCode,
    options: AbaNinjaErrorOptions = {},
  ) {
    super(options.message ?? MESSAGES[code], options.cause === undefined ? undefined : { cause: options.cause });
    this.retryable = RETRYABLE_CODES.has(code);
    this.status = options.status;
  }
}

function codeFromStatus(status: number): AbaNinjaErrorCode {
  if (status === 401 || status === 403) return "non_autorise";
  if (status === 404) return "introuvable";
  if (status === 429) return "trop_de_requetes";
  if (status >= 500) return "indisponible";
  if (status >= 400) return "donnees_refusees";
  return "reponse_invalide";
}

/** Transforme un statut HTTP hors 2xx en erreur typée. */
export function errorFromStatus(status: number): AbaNinjaError {
  return new AbaNinjaError(codeFromStatus(status), { status });
}
