import type { IsoDate } from "../metafields/definitions";
import type { AgendaView, DateRange } from "./types";

/**
 * Dates de l'agenda, toujours calculées à l'heure suisse (Europe/Zurich),
 * quel que soit le fuseau du serveur (Vercel tourne en UTC).
 * Les calculs se font sur des dates calendaires (AAAA-MM-JJ) à midi UTC :
 * aucun passage à l'heure d'été ne peut décaler un jour.
 */

const SWISS_TIME_ZONE = "Europe/Zurich";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Date calendaire suisse d'un instant donné, au format AAAA-MM-JJ. */
export function swissIsoDate(instant: Date): IsoDate {
  // Le format « sv-SE » produit directement AAAA-MM-JJ.
  return instant.toLocaleDateString("sv-SE", { timeZone: SWISS_TIME_ZONE }) as IsoDate;
}

function noonUtc(date: IsoDate): number {
  return new Date(`${date}T12:00:00Z`).getTime();
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(noonUtc(date) + days * DAY_IN_MS).toISOString().slice(0, 10) as IsoDate;
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((noonUtc(to) - noonUtc(from)) / DAY_IN_MS);
}

/** Lundi = 0 … dimanche = 6. */
function weekdayIndex(date: IsoDate): number {
  return (new Date(noonUtc(date)).getUTCDay() + 6) % 7;
}

/** Semaine du lundi au dimanche contenant `date`. */
export function weekContaining(date: IsoDate): DateRange {
  const monday = addDays(date, -weekdayIndex(date));
  return { start: monday, end: addDays(monday, 6) };
}

/** Les 7 jours d'une semaine, du lundi au dimanche. */
export function daysOfWeek(week: DateRange): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(week.start, index));
}

/** Intervalle couvert par une vue : le jour même, ou du lundi au dimanche. */
export function rangeForView(view: AgendaView, now: Date): DateRange {
  const today = swissIsoDate(now);
  return view === "aujourdhui" ? { start: today, end: today } : weekContaining(today);
}

const LONG_DATE = new Intl.DateTimeFormat("fr-CH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const SHORT_WEEKDAY = new Intl.DateTimeFormat("fr-CH", { weekday: "short", timeZone: "UTC" });

/** Libellé lisible d'un intervalle, ex. « lundi 19 octobre – dimanche 25 octobre ». */
export function formatRange(range: DateRange): string {
  const start = LONG_DATE.format(new Date(noonUtc(range.start)));
  if (range.start === range.end) return start;
  return `${start} – ${LONG_DATE.format(new Date(noonUtc(range.end)))}`;
}

/** Jour de la semaine abrégé, ex. « lun. ». */
export function shortWeekday(date: IsoDate): string {
  return SHORT_WEEKDAY.format(new Date(noonUtc(date)));
}
