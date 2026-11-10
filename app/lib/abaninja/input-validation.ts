import { z } from "zod";
import { failure, success, type Result } from "../core/result";
import { AbaNinjaError } from "./errors";
import { UUID_PATTERN } from "./uuid";

/**
 * Briques de validation des données saisies par l'utilisateur, appliquées
 * AVANT tout envoi à AbaNinja. Les messages d'erreur ne citent que le nom
 * des champs fautifs, jamais leur contenu (données personnelles possibles).
 */

/**
 * Caractères invisibles ou de contrôle : Cc (contrôle, dont C1), Cf (format : zéro-largeur,
 * marques bidirectionnelles U+202A–202E et U+2066–2069), Zl et Zp (U+2028 et U+2029).
 */
const INVISIBLE_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const ALLOWED_IN_MULTILINE = new Set(["\n", "\r", "\t"]);

export function hasNoControlCharacter(value: string, allowLineBreaks: boolean): boolean {
  return [...value].every((char) => (allowLineBreaks && ALLOWED_IN_MULTILINE.has(char)) || !INVISIBLE_CHARACTER.test(char));
}

/** Texte sur une ligne, nettoyé des espaces de bord, sans caractère de contrôle. */
export function singleLine(max: number): z.ZodString {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => hasNoControlCharacter(value, false), "caractère de contrôle interdit");
}

/** Texte libre sur plusieurs lignes (retours à la ligne autorisés, autres caractères de contrôle interdits). */
export function multiLine(max: number): z.ZodString {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => hasNoControlCharacter(value, true), "caractère de contrôle interdit");
}

export const uuidField = z.string().regex(UUID_PATTERN, "UUID invalide");

const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(value: string): boolean {
  const match = DATE_FORMAT.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Date AAAA-MM-JJ qui existe vraiment au calendrier (pas de 31 février). */
export const isoDate = z.string().refine(isRealDate, "date attendue au format AAAA-MM-JJ, existante");

/** Vrai si le nombre n'a pas plus de `decimals` décimales. */
export function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}

function refusedMessage(error: z.ZodError, what: string): string {
  const fields = [...new Set(error.issues.map((issue) => issue.path.join(".") || "(ensemble)"))];
  return `${what} : informations invalides (${fields.join(", ")}). Rien n'a été envoyé à AbaNinja.`;
}

/** Valide une entrée ; l'échec ne contient que les noms de champs. */
export function validateInput<TOutput>(
  schema: z.ZodType<TOutput>,
  input: unknown,
  what: string,
): Result<TOutput, AbaNinjaError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return success(parsed.data);
  return failure(new AbaNinjaError("donnees_refusees", { message: refusedMessage(parsed.error, what) }));
}
