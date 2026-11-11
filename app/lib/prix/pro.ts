import { formatChf } from "../format/money";

/**
 * La règle des prix de BluePoint : le prix écrit dans l'app est le PRIX PRO. Les particuliers paient 15 % de plus.
 *
 * Shopify ne connaît qu'un prix par bouteille : on y enregistre le prix particulier (prix pro + 15 %).
 * Les clients marqués « pro » ont la remise automatique « Prix pro », réglée pour retomber exactement
 * sur le prix pro : 1 − 1/1,15 ≈ 13,04 % (et non 15 %, qui ferait payer le pro moins que son prix).
 */

/** +15 % pour les particuliers. */
export const PUBLIC_MARKUP_PERCENT = 15;

/** Remise des pros sur le prix particulier, en fraction (≈ 0,1304) : ramène exactement au prix pro. */
export const PRO_DISCOUNT_FRACTION = 1 - 100 / (100 + PUBLIC_MARKUP_PERCENT);

/** Prix pro → prix particulier enregistré dans Shopify (au centime). 45.00 → 51.75. */
export function publicCentsFromPro(proCents: number): number {
  return Math.round((proCents * (100 + PUBLIC_MARKUP_PERCENT)) / 100);
}

/** Prix particulier de Shopify → prix pro affiché dans l'app (au centime). 51.75 → 45.00. */
export function proCentsFromPublic(publicCents: number): number {
  return Math.round((publicCents * 100) / (100 + PUBLIC_MARKUP_PERCENT));
}

/** « Prix pro CHF 45.00 · particuliers CHF 51.75 ». */
export function priceLine(publicCents: number): string {
  return `Prix pro ${formatChf(proCentsFromPublic(publicCents))} · particuliers ${formatChf(publicCents)}`;
}
