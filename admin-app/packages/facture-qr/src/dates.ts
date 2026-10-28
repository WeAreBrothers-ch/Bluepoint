import { FactureError } from "./erreurs";

const JOUR_EN_MS = 86_400_000;
const FORMAT_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Lit une date « AAAA-MM-JJ » (minuit UTC) ; renvoie null si la date est impossible (ex. 31 février). */
export function lireDateIsoOuNull(iso: string): Date | null {
  const morceaux = FORMAT_ISO.exec(iso);
  if (!morceaux) return null;
  const [annee, mois, jour] = morceaux.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  const coherente =
    date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour;
  return coherente ? date : null;
}

export function lireDateIso(iso: string): Date {
  const date = lireDateIsoOuNull(iso);
  if (date === null) throw new FactureError(`Date invalide : « ${iso} » (format attendu AAAA-MM-JJ).`);
  return date;
}

export function versIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ajouterJours(iso: string, jours: number): string {
  return versIso(new Date(lireDateIso(iso).getTime() + jours * JOUR_EN_MS));
}

/** Format suisse court : « 2026-10-21 » → « 21.10.2026 ». */
export function formaterDate(iso: string): string {
  const date = lireDateIso(iso);
  const jour = date.getUTCDate().toString().padStart(2, "0");
  const mois = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${jour}.${mois}.${date.getUTCFullYear()}`;
}

const FORMAT_ZURICH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date locale suisse (AAAA-MM-JJ) d'un horodatage ISO, ex. une commande passée à 23 h 30 reste du jour même. */
export function dateLocaleSuisse(horodatage: string): string {
  const instant = new Date(horodatage);
  if (Number.isNaN(instant.getTime())) {
    throw new FactureError(`Horodatage invalide : « ${horodatage} ».`);
  }
  const morceaux = FORMAT_ZURICH.formatToParts(instant);
  const valeur = (type: Intl.DateTimeFormatPartTypes): string =>
    morceaux.find((m) => m.type === type)?.value ?? "";
  return `${valeur("year")}-${valeur("month")}-${valeur("day")}`;
}
