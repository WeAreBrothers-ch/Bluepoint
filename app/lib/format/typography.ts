/**
 * Typographie suisse romande pour les textes de l'interface.
 * Espace fine insécable (U+202F) avant : ; ! ? et %, apostrophe typographique ’
 * comme séparateur de milliers. La police de l'admin Shopify (Inter) a ces glyphes.
 */

export const NNBSP = " ";
export const NBSP = " ";

/** Libellé suivi de deux-points à la française : « Échéance : ». */
export function withColon(label: string): string {
  return `${label}${NNBSP}:`;
}
