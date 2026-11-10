import type { AddressInput } from "./address-input";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import type { InvoiceReceiver } from "./receiver";
import { todayInZurich } from "./invoice-status";

/** Données fictives de l'essai. Rien de réel : aucun client ne peut les reconnaître. */

/** Début commun du nom de tous les clients d'essai (le nom exact porte l'horodatage de l'essai). */
export const TRIAL_CLIENT_NAME = "Client essai BluePoint";
export const TRIAL_POSITION_TEXT = "Essai de connexion BluePoint (à supprimer)";

/** « BP-ESSAI-20261110-121530 » : unique à la seconde, facile à retrouver dans AbaNinja. */
export function trialReference(now: Date): string {
  const compact = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `BP-ESSAI-${compact}`;
}

const REFERENCE_PREFIX = "BP-ESSAI-";

function referenceSuffix(reference: string): string {
  return reference.startsWith(REFERENCE_PREFIX) ? reference.slice(REFERENCE_PREFIX.length) : reference;
}

/** Nom exact du client d'essai : unique à chaque essai, pour qu'AbaNinja ne le prenne jamais pour un doublon. */
export function trialClientName(reference: string): string {
  return `${TRIAL_CLIENT_NAME} ${referenceSuffix(reference)} (à supprimer)`;
}

export function trialAddress(reference: string): AddressInput {
  return {
    kind: "company",
    name: trialClientName(reference),
    street: "Rue de l’Essai",
    streetNumber: "1",
    zipCode: "1000",
    state: "VD",
    city: "Lausanne",
    email: `essai-${referenceSuffix(reference).toLowerCase()}@example.com`,
    language: "fr",
    countryCode: "CH",
  };
}

/** Une facture d'une seule position à 1.00 CHF, sans TVA. Elle reste en brouillon : on ne l'envoie jamais. */
export function trialInvoice(
  receiver: InvoiceReceiver,
  bankAccountUuid: string,
  reference: string,
  now: Date,
): AbaNinjaInvoiceInput {
  const today = todayInZurich(now);
  return {
    receiver,
    bankAccountUuid,
    reference,
    title: "Essai de connexion",
    currencyCode: "CHF",
    invoiceDate: today,
    dueDate: today,
    pricesIncludeVat: false,
    positions: [
      { positionNumber: 1, description: TRIAL_POSITION_TEXT, quantity: 1, unitPrice: 1, vatPercentage: 0 },
    ],
  };
}
