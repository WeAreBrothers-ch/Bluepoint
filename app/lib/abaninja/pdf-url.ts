import { failure, success, type Result } from "../core/result";
import { AbaNinjaError } from "./errors";

/**
 * Contrôle de l'adresse de téléchargement du PDF renvoyée par AbaNinja.
 * Fail-closed : tout ce qui n'est pas explicitement autorisé est refusé.
 */

const API_HOST = "api.abaninja.ch";
/** Domaines autorisés : l'API elle-même et les sous-domaines de abaninja.ch. */
const ALLOWED_HOST_SUFFIX = ".abaninja.ch";
const MAX_URL_LENGTH = 2048;

export interface CheckedDownloadUrl {
  readonly url: URL;
  /** Le jeton ne part que vers l'API elle-même, jamais vers un autre hôte. */
  readonly sendAuthorization: boolean;
}

function refused(reason: string): Result<never, AbaNinjaError> {
  return failure(
    new AbaNinjaError("reponse_invalide", { message: `Téléchargement du PDF refusé par sécurité : ${reason}.` }),
  );
}

function hasForbiddenCharacter(raw: string): boolean {
  return [...raw].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code <= 32 || code === 127 || char === "\\";
  });
}

function isAllowedHost(hostname: string): boolean {
  if (hostname === API_HOST) return true;
  return hostname.endsWith(ALLOWED_HOST_SUFFIX) && hostname.length > ALLOWED_HOST_SUFFIX.length;
}

function parse(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

/** Vérifie https, hôte autorisé, pas d'identifiants, port par défaut. */
export function checkDownloadUrl(raw: string): Result<CheckedDownloadUrl, AbaNinjaError> {
  if (raw.length > MAX_URL_LENGTH || hasForbiddenCharacter(raw)) return refused("adresse illisible");
  const url = parse(raw);
  if (url === undefined) return refused("adresse illisible");
  if (url.protocol !== "https:") return refused("l'adresse n'est pas en https");
  if (url.username !== "" || url.password !== "") return refused("l'adresse contient des identifiants");
  if (url.port !== "") return refused("port non standard");
  if (!isAllowedHost(url.hostname)) return refused(`hôte non autorisé (${url.hostname.slice(0, 80)})`);
  return success({ url, sendAuthorization: url.hostname === API_HOST });
}
