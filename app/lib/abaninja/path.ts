import { failure, success, type Result } from "../core/result";
import { AbaNinjaError } from "./errors";
import { isUuid } from "./uuid";

/**
 * Construction du chemin de requête. L'hôte est fixe (voir http.server.ts) ;
 * ici on empêche toute injection dans le chemin (../, ?, #, //, @…).
 */

export const ABANINJA_BASE_URL = "https://api.abaninja.ch";

/** Segment littéral (ex. "invoices") ou identifiant UUID à valider avant insertion. */
export type PathSegment = string | { readonly uuid: string };
export type QueryParams = Readonly<Record<string, string | number | boolean>>;

const LITERAL_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_IN_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function invalidPath(): Result<never, AbaNinjaError> {
  return failure(
    new AbaNinjaError("donnees_refusees", { message: "Identifiant ou chemin AbaNinja invalide : requête annulée." }),
  );
}

function encodeSegment(segment: PathSegment): string | undefined {
  if (typeof segment === "string") return LITERAL_SEGMENT.test(segment) ? segment : undefined;
  return isUuid(segment.uuid) ? segment.uuid.toLowerCase() : undefined;
}

function encodeQuery(query: QueryParams | undefined): string {
  if (query === undefined) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) params.set(key, String(value));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

/** Renvoie "/a/b/uuid?x=1" ou une erreur si un segment n'est pas sûr. */
export function buildRequestPath(
  segments: readonly PathSegment[],
  query?: QueryParams,
): Result<string, AbaNinjaError> {
  if (segments.length === 0) return invalidPath();
  const encoded: string[] = [];
  for (const segment of segments) {
    const safe = encodeSegment(segment);
    if (safe === undefined) return invalidPath();
    encoded.push(safe);
  }
  return success(`/${encoded.join("/")}${encodeQuery(query)}`);
}

/** Chemin pour les journaux : sans paramètres de requête, identifiants UUID masqués. */
export function maskPath(path: string): string {
  return (path.split("?")[0] ?? "").replace(UUID_IN_PATH, ":uuid");
}
