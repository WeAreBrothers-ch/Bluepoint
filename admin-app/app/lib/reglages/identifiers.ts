import { isIBANValid, isQRIBAN } from "swissqrbill/utils";

/** Identifiants suisses des réglages : IBAN, QR-IBAN et numéro TVA (IDE). */

/** Poids officiels du chiffre de contrôle de l'IDE (Office fédéral de la statistique). */
const IDE_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4] as const;
const VAT_FORMAT = /^CHE-?(\d{3})\.?(\d{3})\.?(\d{3})(?:\s*(?:TVA|MWST|IVA))?$/i;

/** « che123456788 mwst » → « CHE-123.456.788 TVA », ou null si le chiffre de contrôle est faux. */
export function normalizeVatNumber(raw: string): string | null {
  const parts = VAT_FORMAT.exec(raw.trim());
  if (parts === null) return null;
  const digits = parts.slice(1, 4).join("");
  const sum = IDE_WEIGHTS.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const check = (11 - (sum % 11)) % 11;
  if (check === 10 || check !== Number(digits[8])) return null;
  return `CHE-${parts[1]}.${parts[2]}.${parts[3]} TVA`;
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Compte suisse ou liechtensteinois valide (seuls pays admis par la QR-facture). */
export function isSwissIban(iban: string): boolean {
  return /^(CH|LI)\d{19}$/.test(iban) && isIBANValid(iban);
}

export function isSwissQrIban(iban: string): boolean {
  return isSwissIban(iban) && isQRIBAN(iban);
}

/** « CH9300762011623852957 » → « CH93 0076 2011 6238 5295 7 » pour l'affichage. */
export function formatIbanForDisplay(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}
