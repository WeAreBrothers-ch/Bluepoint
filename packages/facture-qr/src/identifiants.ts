import { isIBANValid, isQRIBAN } from "swissqrbill/utils";

/** Poids officiels du chiffre de contrôle de l'IDE (numéro d'entreprise suisse, OFS). */
const POIDS_IDE = [5, 4, 3, 2, 7, 6, 5, 4] as const;
const FORMAT_TVA = /^CHE-?(\d{3})\.?(\d{3})\.?(\d{3})(?:\s*(?:TVA|MWST|IVA))?$/i;

/**
 * Numéro TVA suisse normalisé, ex. « che123456788 mwst » → « CHE-123.456.788 TVA ».
 * Renvoie null si le format ou le chiffre de contrôle est faux.
 */
export function normaliserNumeroTva(brut: string): string | null {
  const morceaux = FORMAT_TVA.exec(brut.trim());
  if (!morceaux) return null;
  const chiffres = morceaux.slice(1, 4).join("");
  const somme = POIDS_IDE.reduce((total, poids, i) => total + poids * Number(chiffres[i]), 0);
  const controle = (11 - (somme % 11)) % 11;
  if (controle === 10 || controle !== Number(chiffres[8])) return null;
  return `CHE-${morceaux[1]}.${morceaux[2]}.${morceaux[3]} TVA`;
}

/** IBAN sans espaces et en majuscules. */
export function normaliserIban(brut: string): string {
  return brut.replace(/\s+/g, "").toUpperCase();
}

/** Compte suisse ou liechtensteinois valide (seuls pays admis par la QR-facture). */
export function ibanSuisseValide(iban: string): boolean {
  return /^(CH|LI)\d{19}$/.test(iban) && isIBANValid(iban);
}

export function estQrIban(iban: string): boolean {
  return ibanSuisseValide(iban) && isQRIBAN(iban);
}
