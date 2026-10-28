import type { PhoneOrderErrors } from "./schema";

/** Résultat de « Créer la commande », tel qu'affiché par la page. */

export type PhoneOrderOutcome =
  | { readonly kind: "invalide"; readonly message: string; readonly errors: PhoneOrderErrors }
  | { readonly kind: "erreur"; readonly message: string }
  /** Une demande avec la même clé est déjà en cours (double clic). */
  | { readonly kind: "en_cours"; readonly message: string }
  | {
      readonly kind: "commande";
      readonly orderId: string;
      readonly orderName: string;
      /** Vrai pour un bon de commande : paiement attendu plus tard. */
      readonly paymentPending: boolean;
      /** Remarques non bloquantes (modèle de délai approché, métachamps à vérifier…). */
      readonly warnings: readonly string[];
      /** La commande existait déjà pour cette clé : rien n'a été recréé. */
      readonly replayed: boolean;
    }
  | {
      /** Commande provisoire créée mais pas terminée (conditions de paiement indisponibles). */
      readonly kind: "brouillon";
      readonly draftOrderId: string;
      readonly draftName: string;
      readonly message: string;
    };

export const MESSAGES = {
  invalide: "Certains champs sont à corriger.",
  indisponible: "Shopify ne répond pas pour le moment. Réessayez : la commande ne sera pas créée deux fois.",
  enCours: "Cette commande est déjà en cours de création. Patientez quelques secondes.",
  base: "La commande n’a pas pu être enregistrée. Réessayez.",
  brouillonSansConditions:
    "Shopify n’accepte pas les conditions de paiement sur cette boutique : la commande est restée en commande provisoire, pour ne pas la marquer payée. Ouvrez-la dans Shopify pour la terminer.",
  metachampsNonPoses:
    "Les dates et le mode de livraison n’ont pas pu être copiés sur la commande : vérifiez-les dans Shopify.",
} as const;

export function netTermsWarning(requestedDays: number, templateName: string): string {
  return `Délai de ${requestedDays} jours introuvable chez Shopify\u202F: conditions «\u202F${templateName}\u202F» appliquées.`;
}

interface UserErrorLike {
  readonly field: readonly string[] | null;
  readonly message: string;
}

/** Shopify refuse-t-il la commande à cause des conditions de paiement (offre, autorisation) ? */
export function isPaymentTermsRefusal(userErrors: readonly UserErrorLike[]): boolean {
  return userErrors.some(
    (error) =>
      (error.field ?? []).some((part) => part.toLowerCase().includes("paymentterms")) ||
      /payment ?terms|conditions de paiement/i.test(error.message),
  );
}

/** Message affiché pour un refus de Shopify (les détails viennent de Shopify, en anglais parfois). */
export function refusalMessage(detail: string): string {
  return `Shopify a refusé la commande\u202F: ${detail}`;
}
