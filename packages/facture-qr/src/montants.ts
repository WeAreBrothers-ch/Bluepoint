/**
 * Tous les montants circulent en centimes entiers (ex. CHF 24.50 → 2450) :
 * aucune erreur d'arrondi possible dans les additions.
 */

/** Apostrophe typographique, séparateur de milliers suisse. */
const SEPARATEUR_MILLIERS = "’";

/** Signe moins typographique (plus lisible que le trait d'union). */
const SIGNE_MOINS = "−";

export function sommeCentimes(montants: readonly number[]): number {
  return montants.reduce((total, montant) => total + montant, 0);
}

/** Format suisse : 144000 → « 1’440.00 », -5000 → « −50.00 ». */
export function formaterMontant(centimes: number): string {
  if (!Number.isSafeInteger(centimes)) {
    throw new RangeError(`Montant en centimes invalide : ${centimes}`);
  }
  const signe = centimes < 0 ? SIGNE_MOINS : "";
  const absolu = Math.abs(centimes);
  const francs = Math.trunc(absolu / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR_MILLIERS);
  const reste = (absolu % 100).toString().padStart(2, "0");
  return `${signe}${francs}.${reste}`;
}

/** Ex. « CHF 1’440.00 ». L'espace est insécable pour ne jamais séparer la devise du montant. */
export function formaterCHF(centimes: number): string {
  return `CHF ${formaterMontant(centimes)}`;
}

/** Montant décimal en texte (ex. « 24.5 », « 1440.00 ») → centimes, sans passer par un nombre à virgule. */
export function centimesDepuisTexte(montant: string): number | null {
  const morceaux = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(montant.trim());
  if (!morceaux) return null;
  const [, moins, francs = "0", decimales = ""] = morceaux;
  const centimes = Number.parseInt(francs, 10) * 100 + Number.parseInt(decimales.padEnd(2, "0"), 10);
  if (!Number.isSafeInteger(centimes)) return null;
  return moins === undefined ? centimes : -centimes;
}

/** Taux de TVA au format suisse : 8.1 → « 8,1 % » (espace fine insécable avant %). */
export function formaterTaux(pourcentage: number): string {
  const texte = (Math.round(pourcentage * 100) / 100).toString().replace(".", ",");
  return `${texte} %`;
}
