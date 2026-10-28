/**
 * Typographie française de Suisse romande pour les textes de la facture.
 * Règles appliquées :
 * - espace fine insécable avant « ; : ! ? » (jamais de retour à la ligne avant le signe) ;
 * - apostrophe typographique « ’ » à la place de l'apostrophe droite ;
 * - espaces insécables à l'intérieur des guillemets « ».
 */

export const ESPACE_FINE = " ";
export const ESPACE_INSECABLE = " ";

/** Signe de ponctuation haute précédé d'un mot (évite de toucher « 13:39 » ou les URL). */
const PONCTUATION_HAUTE = /(\S)[   ]*([;:!?])(?=\s|$)/gu;
const APOSTROPHE_DROITE = /(\p{L})'(?=\p{L})/gu;
const GUILLEMET_OUVRANT = /«[   ]*/gu;
const GUILLEMET_FERMANT = /[   ]*»/gu;

export function typographier(texte: string): string {
  return texte
    .replace(APOSTROPHE_DROITE, "$1’")
    .replace(PONCTUATION_HAUTE, `$1${ESPACE_FINE}$2`)
    .replace(GUILLEMET_OUVRANT, `«${ESPACE_INSECABLE}`)
    .replace(GUILLEMET_FERMANT, `${ESPACE_INSECABLE}»`);
}

/** Libellé suivi de sa valeur, ex. « Échéance : 21.11.2026 ». */
export function libelleValeur(libelle: string, valeur: string): string {
  return `${typographier(libelle)}${ESPACE_FINE}:${ESPACE_INSECABLE}${valeur}`;
}
