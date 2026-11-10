import { logInfo } from "../core/logger.server";

/**
 * Journal serveur du corps d'une réponse d'erreur AbaNinja, pour comprendre
 * un refus sans jamais exposer de donnée client. On n'écrit QUE : le `type`
 * d'erreur, le `requestUuid`, le `status` du corps, les NOMS des champs de
 * `detail`, la forme du corps (chemins de clés) et, pour l'API Adresses, le code `error`. Jamais les valeurs, jamais
 * le corps brut. Rien de tout cela n'entre dans un message d'erreur.
 */

export const MAX_ERROR_BODY_BYTES = 16 * 1024;
const MAX_FIELD_NAMES = 20;
const MAX_TEXT_LENGTH = 100;
const FIELD_NAME_PATTERN = /[^A-Za-z0-9_.[\]-]/g;
const SAFE_TEXT_PATTERN = /[^A-Za-z0-9_.:/#-]/g;

type LogValue = string | number | boolean | null;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return value.replace(SAFE_TEXT_PATTERN, "?").slice(0, MAX_TEXT_LENGTH);
}

function fieldNames(detail: unknown): string | undefined {
  if (!isRecord(detail)) return undefined;
  const names = Object.keys(detail)
    .slice(0, MAX_FIELD_NAMES)
    .map((key) => key.replace(FIELD_NAME_PATTERN, "?").slice(0, 60));
  return names.length === 0 ? undefined : names.join(",");
}

const MAX_PATHS = 30;
const MAX_DEPTH = 3;

/** Chemins des clés du corps (« errors.language »), sans aucune valeur : montre quel champ est refusé. */
function keyPaths(value: unknown, prefix = "", depth = 0): string[] {
  if (!isRecord(value) || depth >= MAX_DEPTH) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}${key.replace(FIELD_NAME_PATTERN, "?").slice(0, 60)}`;
    return [path, ...keyPaths(child, `${path}.`, depth + 1)];
  });
}

function parseBody(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

function summarize(body: unknown): Readonly<Record<string, LogValue>> {
  if (!isRecord(body)) return {};
  const summary: Record<string, LogValue> = {};
  const type = safeText(body["type"]);
  const requestUuid = safeText(body["requestUuid"]);
  const code = safeText(body["error"]);
  const fields = fieldNames(body["detail"]);
  if (type !== undefined) summary["type"] = type;
  if (requestUuid !== undefined) summary["requestUuid"] = requestUuid;
  if (typeof body["status"] === "number") summary["statutCorps"] = body["status"];
  if (code !== undefined) summary["codeErreur"] = code;
  if (fields !== undefined) summary["champs"] = fields;
  const shape = keyPaths(body).slice(0, MAX_PATHS);
  if (shape.length > 0) summary["forme"] = shape.join(",");
  return summary;
}

/** Journalise le résumé sûr d'une réponse d'erreur (un corps illisible donne simplement un journal sans détail). */
export function logErrorBody(status: number, path: string, bytes: Uint8Array): void {
  logInfo("AbaNinja : détail du refus", { statut: status, path, ...summarize(parseBody(bytes)) });
}
