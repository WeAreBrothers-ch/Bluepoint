import type { IsoDate } from "../metafields/definitions";

/**
 * Affichage des dates calendaires (AAAA-MM-JJ) au format suisse jj.mm.aaaa.
 * Simple découpage de chaîne : aucun objet Date, donc aucun décalage de fuseau.
 */

const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatSwissDate(date: IsoDate): string {
  const parts = ISO_PARTS.exec(date);
  if (parts === null) return date;
  return `${parts[3]}.${parts[2]}.${parts[1]}`;
}

/** Jour et mois seulement, ex. « 21.10 », pour les colonnes de la semaine. */
export function formatShortSwissDate(date: IsoDate): string {
  const parts = ISO_PARTS.exec(date);
  if (parts === null) return date;
  return `${parts[3]}.${parts[2]}`;
}

const SWISS_TIME_ZONE = "Europe/Zurich";

/** Horodatage (ex. date d'envoi) → « 21.10.2026, 14:05 » à l'heure suisse. */
export function formatSwissDateTime(instant: Date): string {
  const formatter = new Intl.DateTimeFormat("fr-CH", {
    timeZone: SWISS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatter.format(instant);
}
