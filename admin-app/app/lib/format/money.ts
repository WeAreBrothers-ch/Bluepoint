import { NBSP } from "./typography";

/** Montants en centimes → « CHF 1’440.00 » (apostrophe typographique, point décimal). */

const THOUSANDS_SEPARATOR = "’";
const MINUS = "−";

export function formatAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Montant en centimes invalide : ${cents}`);
  const sign = cents < 0 ? MINUS : "";
  const absolute = Math.abs(cents);
  const francs = Math.trunc(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  const rappen = (absolute % 100).toString().padStart(2, "0");
  return `${sign}${francs}.${rappen}`;
}

export function formatChf(cents: number): string {
  return `CHF${NBSP}${formatAmount(cents)}`;
}

/** Nombre entier avec l'apostrophe suisse des milliers : 1’250. */
export function formatInteger(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Nombre entier invalide : ${value}`);
  const sign = value < 0 ? MINUS : "";
  return `${sign}${Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR)}`;
}
