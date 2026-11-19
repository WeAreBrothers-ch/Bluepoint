import { failure, success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import type { PathSegment } from "./path";
import { invoiceActionsResponseSchema } from "./schemas";

/**
 * Noms des actions qu'AbaNinja autorise sur un document (facture, bon de livraison…).
 * Diagnostic : seuls des noms d'action nettoyés sortent, jamais de donnée client.
 */

const MAX_ACTION_NAMES = 40;
const ACTION_NAME_PATTERN = /[^A-Za-z0-9_]/g;

function actionNameOf(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (typeof entry !== "object" || entry === null) return undefined;
  const record = entry as Readonly<Record<string, unknown>>;
  const name = record["name"] ?? record["action"];
  return typeof name === "string" ? name : undefined;
}

function cleanNames(names: readonly (string | undefined)[]): string[] {
  return names
    .filter((name): name is string => name !== undefined && name !== "")
    .slice(0, MAX_ACTION_NAMES)
    .map((name) => name.replace(ACTION_NAME_PATTERN, "?").slice(0, 40));
}

/** `actionsPath` : chemin complet de la ressource « …/{uuid}/actions » du document. */
export async function listDocumentActionNames(
  config: AbaNinjaConfig,
  actionsPath: readonly PathSegment[],
  options: CallOptions = {},
): Promise<Result<string[], AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "GET",
    path: actionsPath,
    schema: invoiceActionsResponseSchema,
  });
  if (!result.ok) return result;
  const data = result.value.data;
  if (Array.isArray(data)) return success(cleanNames(data.map(actionNameOf)));
  if (typeof data === "object" && data !== null) return success(cleanNames(Object.keys(data)));
  return failure(new AbaNinjaError("reponse_invalide"));
}
