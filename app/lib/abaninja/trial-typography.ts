import { NNBSP } from "../format/typography";

/**
 * Typographie française des textes de l'essai : espace fine insécable avant « : ; ? ! »
 * et à l'intérieur des guillemets « ». Les textes sont écrits avec des espaces normales ;
 * cette fonction les remplace au moment d'afficher.
 */
export function frenchTypography(text: string): string {
  return text
    .replace(/ ([:;?!»])/g, `${NNBSP}$1`)
    .replace(/« /g, `«${NNBSP}`);
}
