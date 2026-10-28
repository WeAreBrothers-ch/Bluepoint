/**
 * Numéros de téléphone au format international E.164 (« +41796063322 »), pour WhatsApp.
 * Les numéros suisses écrits à la suisse (« 079 606 33 22 », « 0041 79… ») sont convertis ;
 * un numéro étranger doit déjà commencer par + ou 00.
 */

const SWISS_COUNTRY_CODE = "41";

export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const compact = raw.replace(/[\s().\-/]/g, "");
  let digits: string;
  if (/^\+\d+$/.test(compact)) digits = compact.slice(1);
  else if (/^00\d+$/.test(compact)) digits = compact.slice(2);
  else if (/^0\d{9}$/.test(compact)) digits = `${SWISS_COUNTRY_CODE}${compact.slice(1)}`;
  else return null;
  // Numéro suisse : indicatif 41 suivi de 9 chiffres, sans le 0 national (« +41 (0)79… »).
  if (digits.startsWith(`${SWISS_COUNTRY_CODE}0`)) digits = `${SWISS_COUNTRY_CODE}${digits.slice(3)}`;
  if (digits.startsWith(SWISS_COUNTRY_CODE) && digits.length !== 11) return null;
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/** Premier numéro exploitable parmi plusieurs sources (commande, adresse, fiche client). */
export function firstValidPhone(candidates: readonly (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    const phone = normalizePhoneE164(candidate);
    if (phone !== null) return phone;
  }
  return null;
}

/** Lien « cliquer pour discuter » de WhatsApp, avec le message prérempli. */
export function whatsappUrl(phoneE164: string, message: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
}
